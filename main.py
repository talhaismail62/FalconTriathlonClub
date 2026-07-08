import os
import requests
import time
import asyncio
from fastapi import FastAPI, Response, Cookie
from fastapi.responses import RedirectResponse
from supabase import create_client
from typing import Any, Optional
from datetime import datetime

CLIENT_ID = 184811 #os.getenv("STRAVA_CLIENT_ID")
CLIENT_SECRET = "f211a3bf3d878f3e9096cb90f6d3d78c75ed2477" #os.getenv("STRAVA_CLIENT_SECRET")
REDIRECT_URI = "https://stravabackend.onrender.com/exchange_token" #os.getenv("STRAVA_REDIRECT_URI")
SCOPE = "read,activity:read_all"

SUPABASE_URL = "https://hicsdiuldmcpolnvyapv.supabase.co" #os.getenv("SUPABASE_URL")
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpY3NkaXVsZG1jcG9sbnZ5YXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyOTM3NTAsImV4cCI6MjA3NDg2OTc1MH0.UumpymuCYtykPsp0f3EWY_UduwuhNizzFupT4LeaKEs" #os.getenv("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
app = FastAPI()


# ─────────────────────────────────────────────────────────────────────────────
# NOTE: The SCORES table in Supabase must have these columns (add via migration):
#
#   score         FLOAT
#   run_score     FLOAT
#   ride_score    FLOAT
#   swim_score    FLOAT
#   run_count     INT         ← new
#   ride_count    INT         ← new
#   swim_count    INT         ← new
#   run_distance  FLOAT       ← new  (km)
#   ride_distance FLOAT       ← new  (km)
#   swim_distance FLOAT       ← new  (km)
#   total_activities INT      ← new
#   total_distance   FLOAT    ← new  (km)
# ─────────────────────────────────────────────────────────────────────────────


def compute_scores(distance: list, elevation: list) -> dict:
    """
    Compute overall and per-sport scores from distance/elevation arrays.
    Index 0 = Run, 1 = Ride, 2 = Swim  (distances in km, elevation in m)
    Returns a dict with: score, run_score, ride_score, swim_score
    """
    run_score  = distance[0] + elevation[0] / 100
    ride_score = distance[1] / 4 + elevation[1] / 300
    swim_score = distance[2] / 0.25
    total      = run_score + ride_score + swim_score
    return {
        "score":      round(total, 2),
        "run_score":  round(run_score, 2),
        "ride_score": round(ride_score, 2),
        "swim_score": round(swim_score, 2),
    }


@app.get("/check")
def isApp():
    return "App is Running on Render"


@app.get("/login")
def login():
    auth = (
        "https://www.strava.com/oauth/authorize"
        f"?client_id={CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&response_type=code"
        f"&scope={SCOPE}"
    )
    return RedirectResponse(url=auth)


# ─────────────────────────────────────────────────────────────────────────────
# Admin endpoint — call once per month to pull Strava data and write to DB.
# Flutter frontend does NOT call this for display; it reads SCORES directly.
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/Mleaderboard")
async def MleaderBoard(before: int, after: int):

    users = supabase.table("USERS").select(
        "id, username, gender, first_name, last_name"
    ).execute().data

    lb_male   = []
    lb_female = []

    url = (
        f"https://www.strava.com/api/v3/athlete/activities"
        f"?before={before}&after={after}&per_page=200"
    )

    for u in users:
        print(f"Processing {u['first_name']} {u['last_name']} ({u['id']})")

        token = await ensure_accessToken_valid(u["id"])
        response = requests.get(url, headers={"Authorization": f"Bearer {token}"})
        data = response.json()
        date = datetime.fromtimestamp(after)

        distance = [0.0, 0.0, 0.0]   # Run, Ride, Swim  (km)
        elevation = [0.0, 0.0, 0.0]  # Run, Ride, Swim  (m)
        counts    = [0, 0, 0]         # Run, Ride, Swim  (activity count)

        for d in data:
            activity_type = d.get("type", "")

            if activity_type == "Run":
                idx = 0
            elif activity_type == "Ride":
                idx = 1
            elif activity_type == "Swim":
                idx = 2
            else:
                continue

            distance[idx] += d["distance"] / 1000          # metres → km
            elevation[idx] += d["total_elevation_gain"]    # already metres
            counts[idx]    += 1

        scores = compute_scores(distance, elevation)

        total_activities = counts[0] + counts[1] + counts[2]
        total_distance   = round(distance[0] + distance[1] + distance[2], 2)

        # ── persist per-sport tables ──────────────────────────────────────────
        supabase.table("RUNS").upsert({
            "id":        u["id"],
            "distance":  distance[0],
            "elevation": elevation[0],
        }, on_conflict="id").execute()

        supabase.table("RIDES").upsert({
            "id":        u["id"],
            "distance":  distance[1],
            "elevation": elevation[1],
        }, on_conflict="id").execute()

        supabase.table("SWIMS").upsert({
            "id":       u["id"],
            "distance": distance[2],
        }, on_conflict="id").execute()

        # ── persist SCORES row (month + year key) ─────────────────────────────
        supabase.table("SCORES").upsert({
            "user_id":         u["id"],
            "month":           date.month,
            "year":            date.year,
            "score":           scores["score"],
            "run_score":       scores["run_score"],
            "ride_score":      scores["ride_score"],
            "swim_score":      scores["swim_score"],
            # extended stats
            "run_count":       counts[0],
            "ride_count":      counts[1],
            "swim_count":      counts[2],
            "run_distance":    round(distance[0], 2),
            "ride_distance":   round(distance[1], 2),
            "swim_distance":   round(distance[2], 2),
            "total_activities": total_activities,
            "total_distance":  total_distance,
        }, on_conflict="user_id,month,year").execute()

        entry = {
            "id":               u["id"],
            "username":         u["username"],
            "score":            scores["score"],
            "run_score":        scores["run_score"],
            "ride_score":       scores["ride_score"],
            "swim_score":       scores["swim_score"],
            "run_count":        counts[0],
            "ride_count":       counts[1],
            "swim_count":       counts[2],
            "run_distance":     round(distance[0], 2),
            "ride_distance":    round(distance[1], 2),
            "swim_distance":    round(distance[2], 2),
            "total_activities": total_activities,
            "total_distance":   total_distance,
        }

        if u["gender"] == "male":
            lb_male.append(entry)
        elif u["gender"] == "female":
            lb_female.append(entry)

        print(f"Done: {u['first_name']}, score={scores['score']}")

    lb_male.sort(key=lambda x: x["score"], reverse=True)
    lb_female.sort(key=lambda x: x["score"], reverse=True)

    return {
        "MaleLeaderBoard":   lb_male[:10],
        "FemaleLeaderBoard": lb_female[:10],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Monthly leaderboard — reads from SCORES, joined with USERS.
# Flutter can query Supabase directly; this endpoint exists as a fallback.
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/leaderboard")
async def get_leaderboard(month: int, year: int):
    scores = (
        supabase.table("SCORES")
        .select(
            "score, run_score, ride_score, swim_score, user_id, "
            "run_count, ride_count, swim_count, "
            "run_distance, ride_distance, swim_distance, "
            "total_activities, total_distance"
        )
        .eq("month", month)
        .eq("year", year)
        .order("score", desc=True)
        .execute()
        .data
    )

    user_ids = [s["user_id"] for s in scores]
    users = (
        supabase.table("USERS")
        .select("id, first_name, last_name, gender")
        .in_("id", user_ids)
        .execute()
        .data
    )

    user_map = {
        u["id"]: {
            "name":   f"{u.get('first_name', '')} {u.get('last_name', '')}".strip(),
            "gender": u.get("gender"),
        }
        for u in users
    }

    male_leaderboard   = []
    female_leaderboard = []

    for s in scores:
        user = user_map.get(s["user_id"])
        if not user:
            continue

        entry = {
            "username":         user["name"] or "Unknown",
            "score":            s.get("score", 0),
            "run_score":        s.get("run_score", 0),
            "ride_score":       s.get("ride_score", 0),
            "swim_score":       s.get("swim_score", 0),
            "run_count":        s.get("run_count", 0),
            "ride_count":       s.get("ride_count", 0),
            "swim_count":       s.get("swim_count", 0),
            "run_distance":     s.get("run_distance", 0),
            "ride_distance":    s.get("ride_distance", 0),
            "swim_distance":    s.get("swim_distance", 0),
            "total_activities": s.get("total_activities", 0),
            "total_distance":   s.get("total_distance", 0),
        }

        if user["gender"] == "male":
            male_leaderboard.append(entry)
        elif user["gender"] == "female":
            female_leaderboard.append(entry)

    return {
        "male":   male_leaderboard,
        "female": female_leaderboard,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Yearly leaderboard — aggregates all monthly SCORES rows for the given year.
# Flutter can query Supabase directly; this endpoint exists as a fallback.
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/Yleaderboard")
async def Yleaderboard(year: int):
    scores_data = (
        supabase.table("SCORES")
        .select(
            "user_id, score, run_score, ride_score, swim_score, "
            "run_count, ride_count, swim_count, "
            "run_distance, ride_distance, swim_distance, "
            "total_activities, total_distance, "
            "USERS(username, gender)"
        )
        .eq("year", year)
        .execute()
        .data
    )

    male_stats   = {}
    female_stats = {}

    for s in scores_data:
        user_id    = s["user_id"]
        users_data = s.get("USERS") or {}
        username   = users_data.get("username", "Unknown")
        gender     = users_data.get("gender", "unknown")

        if gender == "male":
            stats = male_stats
        elif gender == "female":
            stats = female_stats
        else:
            continue

        if user_id not in stats:
            stats[user_id] = {
                "id":               user_id,
                "username":         username,
                "score":            0.0,
                "run_score":        0.0,
                "ride_score":       0.0,
                "swim_score":       0.0,
                "run_count":        0,
                "ride_count":       0,
                "swim_count":       0,
                "run_distance":     0.0,
                "ride_distance":    0.0,
                "swim_distance":    0.0,
                "total_activities": 0,
                "total_distance":   0.0,
            }

        stats[user_id]["score"]            += s.get("score", 0)
        stats[user_id]["run_score"]        += s.get("run_score", 0)
        stats[user_id]["ride_score"]       += s.get("ride_score", 0)
        stats[user_id]["swim_score"]       += s.get("swim_score", 0)
        stats[user_id]["run_count"]        += s.get("run_count", 0)
        stats[user_id]["ride_count"]       += s.get("ride_count", 0)
        stats[user_id]["swim_count"]       += s.get("swim_count", 0)
        stats[user_id]["run_distance"]     += s.get("run_distance", 0)
        stats[user_id]["ride_distance"]    += s.get("ride_distance", 0)
        stats[user_id]["swim_distance"]    += s.get("swim_distance", 0)
        stats[user_id]["total_activities"] += s.get("total_activities", 0)
        stats[user_id]["total_distance"]   += s.get("total_distance", 0)

    lb_male   = list(male_stats.values())
    lb_female = list(female_stats.values())

    for user in lb_male + lb_female:
        user["score"]         = round(user["score"], 2)
        user["run_score"]     = round(user["run_score"], 2)
        user["ride_score"]    = round(user["ride_score"], 2)
        user["swim_score"]    = round(user["swim_score"], 2)
        user["run_distance"]  = round(user["run_distance"], 2)
        user["ride_distance"] = round(user["ride_distance"], 2)
        user["swim_distance"] = round(user["swim_distance"], 2)
        user["total_distance"]= round(user["total_distance"], 2)

    lb_male.sort(key=lambda x: x["score"],   reverse=True)
    lb_female.sort(key=lambda x: x["score"], reverse=True)

    return {
        "MaleLeaderBoard":   lb_male[:10],
        "FemaleLeaderBoard": lb_female[:10],
    }


@app.get("/run")
async def run(user_id: str):
    return supabase.table("RUNS").select("*").eq("id", user_id).execute().data[0]


@app.get("/ride")
async def ride(user_id: str):
    return supabase.table("RIDES").select("*").eq("id", user_id).execute().data[0]


@app.get("/swim")
async def swim(user_id: str):
    return supabase.table("SWIMS").select("*").eq("id", user_id).execute().data[0]


# ─────────────────────────────────────────────────────────────────────────────
# OAuth
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/exchange_token")
def exchange_tokens(code: str, scope: str):
    response = requests.post(
        "https://www.strava.com/oauth/token",
        data={
            "client_id":     CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "code":          code,
            "grant_type":    "authorization_code",
        },
    )

    if response.status_code != 200:
        return {"error": response.text}

    token   = response.json()
    athlete = token["athlete"]

    supabase.table("USERS").upsert({
        "id":            athlete["id"],
        "username":      athlete["username"],
        "access_token":  token["access_token"],
        "refresh_token": token["refresh_token"],
        "expires_at":    token["expires_at"],
    }, on_conflict="id").execute()

    return {"message": "success", "athlete_id": athlete["id"]}


@app.get("/epoch")
async def epoch(year: int):
    return {
        "after": {
            "1":  time.mktime(time.strptime(f"1 Jan {year}",  "%d %b %y")),
            "2":  time.mktime(time.strptime(f"1 Feb {year}",  "%d %b %y")),
            "3":  time.mktime(time.strptime(f"1 Mar {year}",  "%d %b %y")),
            "4":  time.mktime(time.strptime(f"1 Apr {year}",  "%d %b %y")),
            "5":  time.mktime(time.strptime(f"1 May {year}",  "%d %b %y")),
            "6":  time.mktime(time.strptime(f"1 Jun {year}",  "%d %b %y")),
            "7":  time.mktime(time.strptime(f"1 Jul {year}",  "%d %b %y")),
            "8":  time.mktime(time.strptime(f"1 Aug {year}",  "%d %b %y")),
            "9":  time.mktime(time.strptime(f"1 Sep {year}",  "%d %b %y")),
            "10": time.mktime(time.strptime(f"1 Oct {year}",  "%d %b %y")),
            "11": time.mktime(time.strptime(f"1 Nov {year}",  "%d %b %y")),
            "12": time.mktime(time.strptime(f"1 Dec {year}",  "%d %b %y")),
        },
        "before": {
            "1":  time.mktime(time.strptime(f"31 Jan {year}", "%d %b %y")),
            "2":  time.mktime(time.strptime(f"28 Feb {year}", "%d %b %y")),
            "3":  time.mktime(time.strptime(f"31 Mar {year}", "%d %b %y")),
            "4":  time.mktime(time.strptime(f"30 Apr {year}", "%d %b %y")),
            "5":  time.mktime(time.strptime(f"31 May {year}", "%d %b %y")),
            "6":  time.mktime(time.strptime(f"30 Jun {year}", "%d %b %y")),
            "7":  time.mktime(time.strptime(f"31 Jul {year}", "%d %b %y")),
            "8":  time.mktime(time.strptime(f"31 Aug {year}", "%d %b %y")),
            "9":  time.mktime(time.strptime(f"30 Sep {year}", "%d %b %y")),
            "10": time.mktime(time.strptime(f"31 Oct {year}", "%d %b %y")),
            "11": time.mktime(time.strptime(f"30 Nov {year}", "%d %b %y")),
            "12": time.mktime(time.strptime(f"31 Dec {year}", "%d %b %y")),
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# Token helpers
# ─────────────────────────────────────────────────────────────────────────────
async def ensure_accessToken_valid(user_id: str):
    response = supabase.table("USERS").select("*").eq("id", user_id).execute()
    user = response.data[0]

    if time.time() >= user["expires_at"]:
        await regenerate_token(user_id, user["refresh_token"])
        user = supabase.table("USERS").select("access_token").eq("id", user_id).execute().data[0]

    return user["access_token"]


async def regenerate_token(user_id: str, refresh_token: str):
    response = requests.post(
        "https://www.strava.com/oauth/token",
        data={
            "client_id":     CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "grant_type":    "refresh_token",
            "refresh_token": refresh_token,
        },
    )

    if response.status_code != 200:
        return False

    new = response.json()

    supabase.table("USERS").upsert({
        "id":            user_id,
        "access_token":  new["access_token"],
        "refresh_token": new["refresh_token"],
        "expires_at":    new["expires_at"],
    }, on_conflict="id").execute()

    return True
