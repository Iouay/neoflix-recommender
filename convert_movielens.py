import pandas as pd

# Chemins vers les fichiers bruts MovieLens
ratings_path = "data/ml-100k/u.data"
movies_path = "data/ml-100k/u.item"

# 1) Ratings: user_id, movie_id, rating, timestamp
ratings = pd.read_csv(
    ratings_path,
    sep="\t",
    names=["user_id", "movie_id", "rating", "timestamp"]
)

# 2) Movies: movie_id + title (u.item est séparé par "|")
movies = pd.read_csv(
    movies_path,
    sep="|",
    encoding="latin-1",
    names=[
        "movie_id", "title", "release_date", "video_release_date",
        "imdb_url", "unknown", "Action", "Adventure", "Animation",
        "Children", "Comedy", "Crime", "Documentary", "Drama", "Fantasy",
        "Film-Noir", "Horror", "Musical", "Mystery", "Romance",
        "Sci-Fi", "Thriller", "War", "Western"
    ]
)

# On garde juste ce qui nous sert
movies = movies[["movie_id", "title"]]

# On exporte en CSV propre
ratings.to_csv("data/ratings.csv", index=False)
movies.to_csv("data/movies.csv", index=False)

print("✅ Conversion done: data/ratings.csv and data/movies.csv created.")
