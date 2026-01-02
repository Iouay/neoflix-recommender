import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity

ratings = pd.read_csv("data/ratings.csv")
movies = pd.read_csv("data/movies.csv")

# Matrice user-item
U = ratings.pivot_table(index="user_id", columns="movie_id", values="rating")

# Moyenne par utilisateur (pour centrer)
user_mean = U.mean(axis=1)

# Centrage: rating - mean(user)
U_centered = U.sub(user_mean, axis=0)

# Pour cosine, on remplace NaN par 0
U_centered_filled = U_centered.fillna(0)

# Similarité user-user sur les notes centrées
sim = cosine_similarity(U_centered_filled)
sim_df = pd.DataFrame(sim, index=U.index, columns=U.index)

# Popularité (fallback)
popularity = (
    ratings.groupby("movie_id")["rating"]
    .agg(["count", "mean"])
    .reset_index()
    .query("count >= 50")  # évite films trop rares
    .sort_values(["mean", "count"], ascending=False)
)

movie_titles = movies.set_index("movie_id")["title"].to_dict()

def recommend(user_id: int, n: int = 10, k: int = 30, explain: bool = True):
    if user_id not in U.index:
        raise ValueError(f"user_id {user_id} not found. Must be between 1 and {U.index.max()}")

    user_ratings = U.loc[user_id]
    seen = user_ratings[user_ratings.notna()].sort_values(ascending=False)

    # Cold-start: si l'user a trop peu noté, recommander popularité
    if seen.shape[0] < 5:
        top_pop = popularity.head(n).copy()
        top_pop["title"] = top_pop["movie_id"].map(movie_titles)
        top_pop = top_pop.rename(columns={"mean": "score"})[["movie_id", "title", "score", "count"]]
        if explain:
            return top_pop, {"type": "popular", "reason": "User has too few ratings (cold-start)."}
        return top_pop

    # Voisins similaires (hors soi-même)
    neighbors = sim_df.loc[user_id].drop(index=user_id).sort_values(ascending=False).head(k)
    neighbors = neighbors[neighbors > 0]  # on garde seulement similitudes positives
    if neighbors.empty:
        # fallback
        top_pop = popularity.head(n).copy()
        top_pop["title"] = top_pop["movie_id"].map(movie_titles)
        top_pop = top_pop.rename(columns={"mean": "score"})[["movie_id", "title", "score", "count"]]
        if explain:
            return top_pop, {"type": "popular", "reason": "No positive-similarity neighbors found."}
        return top_pop

    # Notes centrées des voisins
    neigh_centered = U_centered.loc[neighbors.index]

    scores = {}
    for movie_id in U.columns:
        if pd.notna(user_ratings.get(movie_id)):
            continue  # déjà vu

        # voisins qui ont noté ce film
        neigh_vals = neigh_centered[movie_id].dropna()
        if neigh_vals.empty:
            continue

        w = neighbors.loc[neigh_vals.index]
        pred_centered = (w * neigh_vals).sum() / (w.abs().sum())
        pred = user_mean.loc[user_id] + pred_centered  # on décente
        scores[movie_id] = pred

    if not scores:
        top_pop = popularity.head(n).copy()
        top_pop["title"] = top_pop["movie_id"].map(movie_titles)
        top_pop = top_pop.rename(columns={"mean": "score"})[["movie_id", "title", "score", "count"]]
        if explain:
            return top_pop, {"type": "popular", "reason": "No candidate movies scored."}
        return top_pop

    top_ids = sorted(scores, key=scores.get, reverse=True)[:n]
    recs = pd.DataFrame({
        "movie_id": top_ids,
        "title": [movie_titles.get(mid, "Unknown") for mid in top_ids],
        "score": [scores[mid] for mid in top_ids],
    }).sort_values("score", ascending=False)

    # --- Explanation: "Because you watched..." ---
    explanation = None
    if explain:
        top_seen_ids = list(seen.head(3).index)
        top_seen_titles = [movie_titles.get(mid, "Unknown") for mid in top_seen_ids]
        explanation = {
            "type": "user_based_cf_centered",
            "because_you_watched": top_seen_titles,
            "neighbors_used": int(neighbors.shape[0]),
            "k_requested": k
        }

    return recs, explanation

if __name__ == "__main__":
    user_id = 1
    recs, info = recommend(user_id=user_id, n=10, k=40, explain=True)

    print("START ✅")
    print(f"\nRecommendations for user {user_id}:\n")
    print(recs.to_string(index=False))

    print("\n--- Explanation ---")
    print(info)
