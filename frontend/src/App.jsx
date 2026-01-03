import { useEffect, useRef, useState } from "react";

const API = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(
  /\/$/,
  ""
);
const TMDB_KEY = import.meta.env.VITE_TMDB_KEY;

// TMDB image base
const IMG = "https://image.tmdb.org/t/p/w342";

// --- helpers ---
function extractTitleAndYear(movieTitle) {
  const m = movieTitle.match(/^(.*)\s\((\d{4})\)\s*$/);
  if (m) return { title: m[1].trim(), year: m[2] };
  return { title: movieTitle, year: null };
}

// WebAudio “tudum-like”
function playTudumLike() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  const ctx = new AudioCtx();
  const now = ctx.currentTime;

  const hit = (t, freq, dur, g) => {
    const o = ctx.createOscillator();
    const a = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, t);
    a.gain.setValueAtTime(0.0001, t);
    a.gain.exponentialRampToValueAtTime(g, t + 0.01);
    a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(a);
    a.connect(ctx.destination);
    o.start(t);
    o.stop(t + dur);
  };

  hit(now + 0.0, 55, 0.28, 0.8);
  hit(now + 0.22, 45, 0.35, 0.9);

  setTimeout(() => ctx.close?.(), 900);
}

// TMDB → poster
async function fetchPoster(movie) {
  if (!TMDB_KEY) return null;

  const { title, year } = extractTitleAndYear(movie.title);
  const url =
    `https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(
      TMDB_KEY
    )}` +
    `&query=${encodeURIComponent(title)}` +
    (year ? `&year=${encodeURIComponent(year)}` : "");

  const r = await fetch(url);
  if (!r.ok) return null;

  const d = await r.json();
  return d?.results?.[0]?.poster_path ? IMG + d.results[0].poster_path : null;
}

// TMDB → trailer YouTube (returns key)
async function fetchTrailerKey(movie) {
  if (!TMDB_KEY) return null;

  const { title, year } = extractTitleAndYear(movie.title);
  const searchUrl =
    `https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(
      TMDB_KEY
    )}` +
    `&query=${encodeURIComponent(title)}` +
    (year ? `&year=${encodeURIComponent(year)}` : "");

  const s = await fetch(searchUrl);
  if (!s.ok) return null;

  const sd = await s.json();
  const tmdb = sd?.results?.[0];
  if (!tmdb?.id) return null;

  const v = await fetch(
    `https://api.themoviedb.org/3/movie/${tmdb.id}/videos?api_key=${encodeURIComponent(
      TMDB_KEY
    )}`
  );
  if (!v.ok) return null;

  const vd = await v.json();

  const trailer =
    vd.results?.find((x) => x.site === "YouTube" && x.type === "Trailer") ||
    vd.results?.find((x) => x.site === "YouTube");

  return trailer?.key || null;
}

export default function App() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [seed, setSeed] = useState(null);
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  const posters = useRef(new Map());
  const [, refresh] = useState(0);

  // Hover overlay per card
  const [hoveredId, setHoveredId] = useState(null);

  // Modal trailer state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [trailerKey, setTrailerKey] = useState(null);
  const [trailerLoading, setTrailerLoading] = useState(false);
  const [trailerError, setTrailerError] = useState("");

  const closeModal = () => {
    setModalOpen(false);
    setTrailerKey(null);
    setTrailerLoading(false);
    setTrailerError("");
    setModalTitle("");
  };

  // Close modal on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Tudum once
  useEffect(() => {
    playTudumLike();
  }, []);

  // Search (debounced)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setApiError("");
        const r = await fetch(
          `${API}/movies/search?q=${encodeURIComponent(q)}&limit=10`
        );
        if (!r.ok) throw new Error(`Search API error: ${r.status}`);
        const d = await r.json();
        setSuggestions(d.results || []);
      } catch (e) {
        setSuggestions([]);
        setApiError(String(e?.message || e));
      }
    }, 250);

    return () => clearTimeout(t);
  }, [query]);

  const pickMovie = async (m) => {
    setSeed(m);
    setQuery(m.title);
    setSuggestions([]);
    setLoading(true);
    setApiError("");

    try {
      const r = await fetch(
        `${API}/similar?movie_id=${encodeURIComponent(m.movie_id)}&n=12`
      );
      if (!r.ok) throw new Error(`Similar API error: ${r.status}`);
      const d = await r.json();
      const list = d.recommendations || [];
      setRecs(list);

      // Posters for seed + recs
      for (const x of [m, ...list]) {
        if (!posters.current.has(x.movie_id)) {
          fetchPoster(x)
            .then((p) => {
              posters.current.set(x.movie_id, p);
              refresh((v) => v + 1);
            })
            .catch(() => {
              posters.current.set(x.movie_id, null);
              refresh((v) => v + 1);
            });
        }
      }
    } catch (e) {
      setRecs([]);
      setApiError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const openTrailerModal = async (movie) => {
    setModalOpen(true);
    setModalTitle(movie.title);
    setTrailerKey(null);
    setTrailerError("");
    setTrailerLoading(true);

    try {
      const key = await fetchTrailerKey(movie);
      if (!key) {
        setTrailerError("Trailer unavailable for this title.");
      } else {
        setTrailerKey(key);
      }
    } catch {
      setTrailerError("Trailer unavailable for this title.");
    } finally {
      setTrailerLoading(false);
    }
  };

  return (
    <div style={{ background: "#000", minHeight: "100vh", color: "#fff" }}>
      {/* NAV */}
      <header
        style={{
          padding: "20px 48px",
          fontSize: 28,
          fontWeight: 800,
          color: "#E50914",
        }}
      >
        NEOFLIX
      </header>

      {/* SEARCH */}
      <div style={{ padding: "0 48px", position: "relative", maxWidth: 820 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a movie… (ex: Toy Story)"
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.16)",
            backgroundColor: "rgba(255,255,255,0.06)",
            color: "#fff",
            outline: "none",
          }}
        />

        {suggestions.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: 46,
              left: 48,
              right: 0,
              maxWidth: 820,
              background: "#111",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10,
              overflow: "hidden",
              zIndex: 9999,
              maxHeight: 320,
              overflowY: "auto",
            }}
          >
            {suggestions.map((s) => (
              <div
                key={s.movie_id}
                onClick={() => pickMovie(s)}
                style={{
                  padding: 10,
                  cursor: "pointer",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.08)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {s.title}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* HERO RECTANGLE */}
      <section style={{ padding: "28px 48px 10px" }}>
        <div
          style={{
            borderRadius: 18,
            padding: "28px",
            background:
              "radial-gradient(circle at 20% 20%, rgba(229,9,20,0.28), rgba(0,0,0,0) 55%), linear-gradient(135deg, rgba(25,25,25,0.9), rgba(0,0,0,0.9))",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ color: "#bbb", fontSize: 12, letterSpacing: 2 }}>
            LET’S SEE WHAT YOU’LL WATCH NEXT
          </div>

          <h1 style={{ marginTop: 10, fontSize: 40, lineHeight: 1.1 }}>
            Pick one movie.{" "}
            <span style={{ color: "#E50914" }}>
              We’ll find what you’ll love next.
            </span>
          </h1>

          <p
            style={{
              marginTop: 10,
              color: "#bbb",
              maxWidth: 760,
              lineHeight: 1.6,
            }}
          >
            Powered by collaborative filtering on real user ratings. Search any
            movie, select it, and instantly explore similar titles — with posters
            and trailers.
          </p>

          <div style={{ marginTop: 10, color: "#888", fontSize: 12 }}>
            Backend: <span style={{ color: "#fff" }}>{API}</span>
          </div>
        </div>
      </section>

      {/* ERRORS */}
      {apiError && (
        <div style={{ padding: "0 48px", color: "#ff6b6b" }}>{apiError}</div>
      )}

      {/* RESULTS */}
      {loading && <p style={{ padding: 48 }}>Loading…</p>}

      {seed && !loading && (
        <div style={{ padding: 48 }}>
          <h2>Similar to {seed.title}</h2>

          <div style={{ display: "flex", gap: 14, overflowX: "auto" }}>
            {recs.map((m) => {
              const poster = posters.current.get(m.movie_id);
              const isHover = hoveredId === m.movie_id;

              return (
                <div key={m.movie_id} style={{ width: 200 }}>
                  <div
                    onMouseEnter={() => setHoveredId(m.movie_id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => openTrailerModal(m)}
                    style={{
                      height: 280,
                      cursor: "pointer",
                      position: "relative",
                      background: poster
                        ? `url(${poster}) center / cover`
                        : "linear-gradient(135deg,#e50914,#111)",
                      transition: "transform .25s",
                      borderRadius: 10,
                      overflow: "hidden",
                      transform: isHover ? "scale(1.05)" : "scale(1.0)",
                    }}
                  >
                    {/* Play overlay */}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: isHover ? 1 : 0,
                        transition: "opacity .2s",
                        background: "rgba(0,0,0,0.35)",
                        pointerEvents: "none",
                      }}
                    >
                      <div
                        style={{
                          width: 58,
                          height: 58,
                          borderRadius: 999,
                          background: "rgba(0,0,0,0.55)",
                          border: "1px solid rgba(255,255,255,0.25)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 22,
                        }}
                      >
                        ▶
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 13 }}>{m.title}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL */}
      {modalOpen && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(980px, 96vw)",
              background: "#0b0b0b",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: "0 20px 80px rgba(0,0,0,0.6)",
            }}
          >
            <div
              style={{
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 14 }}>{modalTitle}</div>
              <button
                onClick={closeModal}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#fff",
                  fontSize: 18,
                  cursor: "pointer",
                  padding: 8,
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div style={{ aspectRatio: "16 / 9", background: "#000" }}>
              {trailerLoading && (
                <div style={{ padding: 18, color: "#bbb" }}>
                  Loading trailer…
                </div>
              )}

              {!trailerLoading && trailerError && (
                <div style={{ padding: 18, color: "#ff6b6b" }}>
                  {trailerError}
                </div>
              )}

              {!trailerLoading && trailerKey && (
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0`}
                  title="YouTube trailer"
                  frameBorder="0"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
