from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from pathlib import Path
import math

app = FastAPI(title="Netflix-Like Recommender API")

# CORS (frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Load data ----
BASE_DIR = Path(__file__).resolve().parent      # .../api
DATA_DIR = BASE_DIR.parent / "data"             # .../data

ratings = pd.read_csv(DATA_DIR / "ratings.csv")
movies = pd.read_csv(DATA_DIR / "movies.csv")

movie_titles = movies.set_index("movie_id")["title"].to_dict()

# Movie-user matrix: rows=movie_id, cols=user_id
M = ratings.pivot_table(index="movie_id", columns="user_id", values="rating")
M_filled = M.fillna(0)

# Precompute cosine similarity between movies
movie_sim = cosine_similarity(M_filled)
movie_sim_df = pd.DataFrame(movie_sim, index=M.index, columns=M.index)

def clip_score(x: float) -> float:
    # similarity score in [0,1], but keep sane bounds
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return 0.0
    return max(0.0, min(1.0, float(x)))

@app.get("/")
def root():
    return {"status": "ok", "message": "Netflix-Like Recommender API is running."}

@app.get("/movies/search")
def search_movies(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=25),
):
    q_low = q.lower().strip()
    # simple search on title
    matches = movies[movies["title"].str.lower().str.contains(q_low, na=False)].head(limit)
    return {
        "query": q,
        "results": [
            {"movie_id": int(row.movie_id), "title": str(row.title)}
            for _, row in matches.iterrows()
        ],
    }

@app.get("/similar")
def similar_movies(
    movie_id: int = Query(..., ge=1),
    n: int = Query(12, ge=1, le=50),
):
    if movie_id not in movie_sim_df.index:
        return {"error": f"movie_id {movie_id} not found"}

    sims = movie_sim_df.loc[movie_id].drop(index=movie_id).sort_values(ascending=False)
    top = sims.head(n)

    recs = [
        {
            "movie_id": int(mid),
            "title": movie_titles.get(int(mid), "Unknown"),
            "score": clip_score(score),
        }
        for mid, score in top.items()
    ]

    return {
        "type": "item_to_item_cosine",
        "seed_movie": {"movie_id": int(movie_id), "title": movie_titles.get(int(movie_id), "Unknown")},
        "recommendations": recs,
    }
