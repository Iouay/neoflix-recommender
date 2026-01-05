Neoflix is a machine learning–based movie recommendation system, inspired by Netflix, built from scratch using collaborative filtering on real user ratings data.
The project focuses on the design, implementation, and deployment-ready structure of a recommender system, combining:

- a Machine Learning core (item-to-item similarity),
- a backend API (FastAPI, local),
- and a modern interactive frontend (React).


🧠 Machine Learning Core (Main Focus)
The heart of Neoflix is a collaborative filtering recommender system, implemented without black-box recommender libraries.


🔬 Algorithm
Approach: Item-to-Item Collaborative Filtering
Similarity Metric: Cosine Similarity
Input: Movie–User rating matrix
Output: Top-N recommended movies for a given title


This approach is conceptually similar to early Netflix-style recommenders and is widely taught in machine learning and recommender systems courses.


🧮 ML Pipeline:

- Load real-world ratings data
- Build a movie × user rating matrix
- Handle sparse data (missing ratings)
- Compute cosine similarity between movies
- Rank most similar movies


Return recommendations with similarity scores

📊 Dataset

MovieLens 100K Dataset

- 100,000 ratings
- 943 users
- 1,682 movies


Used for:

- Training the recommender
- Computing similarities
- Realistic recommendation behavior


🛠️ Tech Stack

- Machine Learning / Data
- Python
- Pandas
- NumPy
- scikit-learn
- Cosine Similarity
- Backend (Local / Private)
- FastAPI


REST API for:

- movie search
- similarity-based recommendations
- Frontend
- React
- Vite
- TMDB API (posters & trailers)
- Netflix-inspired UI

⚙️ Project Structure
neoflix-recommender/
├── data/
│   ├── ratings.csv
│   ├── movies.csv
│   └── ml-100k/
│
├── recommender.py              # Item-to-item ML recommender
├── recommend_user_based.py     # Alternative CF approach
├── convert_movielens.py        # Dataset preprocessing
│
├── api/
│   ├── main.py                 # FastAPI backend (local)
│   ├── requirements.txt
│   └── start.sh
│
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   └── tmdb.js
    ├── package.json
    └── vite.config.js

🚀 Frontend Demo

👉 Live UI 
https://neoflix-recommender.vercel.app/

⚠️ Note
The Machine Learning backend is not publicly deployed to avoid:

- unnecessary cloud costs
- security exposure

The full ML logic is available in the repository and runs locally.

▶️ Run Locally
Backend (ML API)
cd api
pip install -r requirements.txt
uvicorn main:app --reload


API available at:
http://127.0.0.1:8000

Frontend
cd frontend
npm install
npm run dev


