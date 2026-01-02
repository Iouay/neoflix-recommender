import pandas as pd

print("START ✅")

ratings = pd.read_csv("data/ratings.csv")
movies = pd.read_csv("data/movies.csv")

print("ratings shape:", ratings.shape)
print("movies shape:", movies.shape)

user_movie_matrix = ratings.pivot_table(
    index="user_id",
    columns="movie_id",
    values="rating"
)

print("user_movie_matrix shape:", user_movie_matrix.shape)
print(user_movie_matrix.head())
