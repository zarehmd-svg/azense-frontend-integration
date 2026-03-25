// src/App.jsx
import { useState } from "react";
import AzenseLogo from "./assets/Azense-logo.png";
import { ChatPanel } from "./components/ChatPanel";

// Use Render backend in production; localhost fallback for local dev
const API_BASE =
  import.meta.env.VITE_API_BASE || "https://azense-backend.onrender.com";
const EPIC_API_BASE = API_BASE;

function formatDischargeSummary(text) {
  if (!text) return "";
  const lines = text.split("\n");
  const patterns = [
    /^1\.\s*Reason for hospitalization and brief hospital course/i,
    /^2\.\s*Procedures and key treatments/i,
    /^3\.\s*Discharge diagnoses/i,
    /^4\.\s*Discharge medications and changes/i,
    /^5\.\s*Follow-up and pending items/i,
  ];
  const processed = lines.map((line) => {
    const trimmed = line.trimStart();
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) {
        return `<strong>${trimmed}</strong>`;
      }
    }
    return line;
  });
  return processed.join("\n");
}


function App() {
  // LOGIN STATE
  const [loggedIn, setLoggedIn] = useState(
    () => window.localStorage.getItem("azense_logged_in") === "true"
  );
  const [loginError, setLoginError] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // MAIN APP STATE
  const [patientId, setPatientId] = useState("1");
  const [input, setInput] = useState("");
  const [summary, setSummary] = useState(null);
  const [coding, setCoding] = useState(null);
  const [training, setTraining] = useState(null);
  const [loading, setLoading] = useState(false);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [activeView, setActiveView] = useState("dc_draft");

  const [wantSummary, setWantSummary] = useState(true);
  const [wantHp, setWantHp] = useState(true);
  const [wantCoding, setWantCoding] = useState(true);
  const [wantInsights, setWantInsights] = useState(true);
  const [wantProblemInsights, setWantProblemInsights] = useState(true);

  const [epicStatus, setEpicStatus] = useState("");

  // LOGIN HANDLER
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword,
        }),
      });
      if (!res.ok) {
        throw new Error(`Login error: ${res.status}`);
      }
      const json = await res.json();
      if (!json.token) {
        throw new Error("No token in response");
      }
      window.localStorage.setItem("azense_logged_in", "true");
      setLoggedIn(true);
    } catch (err) {
      console.error(err);
      setLoginError("Invalid username or password.");
    } finally {
      setLoginLoading(false);
    }
  };

  const startEpicAuth = async () => {
    try {
      setEpicStatus("Contacting backend for EPIC auth URL…");
      setErrorText("");
      const res = await fetch(`${EPIC_API_BASE}/epic/auth`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status}`);
      }
      const data = await res.json();
      setEpicStatus("Redirecting to EPIC…");
      window.location.href = data.auth_url;
    } catch (err) {
      console.error(err);
      setEpicStatus("");
      setErrorText(
        "Unable to start EPIC auth. Check backend /epic/auth and EPIC config."
      );
    }
  };

  const runAzense = async () => {
    setErrorText("");
    setLoading(true);
    setSummary(null);
    setCoding(null);
    setTraining(null);

    try {
      const summaryRes = await fetch(
        `${API_BASE}/generate-summary?patient_id=${encodeURIComponent(
          patientId || "1"
        )}` +
          `&do_summary=${wantSummary}` +
          `&do_hp=${wantHp}` +
          `&do_coding=${wantCoding}` +
          `&do_insights=${wantInsights}` +
          `&do_problem_insights=${wantProblemInsights}`,
        { method: "POST" }
      );
      if (!summaryRes.ok) {
        throw new Error(`Summary error: ${summaryRes.status}`);
      }
      const summaryJson = await summaryRes.json();

      let codingJson = null;
      if (wantCoding) {
        const codingRes = await fetch(
          `${API_BASE}/coding-diagnoses?patient_id=${encodeURIComponent(
            patientId || "1"
          )}`,
          { method: "POST" }
        );
        if (!codingRes.ok) {
          throw new Error(`Coding error: ${codingRes.status}`);
        }
        codingJson = await codingRes.json();
      }

      setSummary(summaryJson);
      setCoding(codingJson);
    } catch (err) {
      console.error(err);
      setErrorText(
        "Unable to reach AZense backend. Check that FastAPI is running and API_BASE is correct."
      );
    } finally {
      setLoading(false);
    }
  };

  const runTraining = async () => {
    if (!summary) {
      return;
    }
    if (training) {
      setActiveView("training");
      return;
    }
    setErrorText("");
    setTrainingLoading(true);

    try {
      const res = await fetch(`${API_BASE}/training-explanations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: patientId || "1" }),
      });
      if (!res.ok) {
        throw new Error(`Training error: ${res.status}`);
      }
      const json = await res.json();
      setTraining(json);
      setActiveView("training");
    } catch (err) {
      console.error(err);
      setErrorText(
        "Unable to load Azense for Residents explanations. Check backend and try again."
      );
    } finally {
      setTrainingLoading(false);
    }
  };

  const renderOutput = () => {
    if (!summary && !coding) {
      return (
        <p
          style={{
            margin: 0,
            color: "#4B5563",
            fontSize: "12px",
          }}
        >
          Enter a patient id (1–24) and click “Run AZense” to generate a draft
          discharge summary, coding suggestions, and AZense insights.
        </p>
      );
    }

    switch (activeView) {
      case "dc_draft": {
        const formatted = formatDischargeSummary(
          summary?.draft_discharge_summary || ""
        );
        return (
          <>
            <h4
              style={{
                margin: "0 0 6px",
                fontSize: "13px",
                color: "#0F172A",
              }}
            >
              Discharge summary
            </h4>
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                fontFamily:
                  "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
                fontSize: "13px",
                color: "#111827",
              }}
            >
              <span
                dangerouslySetInnerHTML={{
                  __html:
                    formatted ||
                    "No draft summary available for this patient.",
                }}
              />
            </pre>
          </>
        );
      }
      case "hp":
        return (
          <>
            <h4
              style={{
                margin: "0 0 6px",
                fontSize: "13px",
                color: "#0F172A",
              }}
            >
              H&P assessment
            </h4>
            <p
              style={{
                margin: "0 0 8px",
                fontSize: "13px",
                color: "#111827",
              }}
            >
              {summary?.hp_assessment ||
                "No dedicated H&P assessment generated yet."}
            </p>

            <h4
              style={{
                margin: "8px 0 4px",
                fontSize: "13px",
                color: "#0F172A",
              }}
            >
              Intake summary (ED / triage / initial data)
            </h4>
            {summary?.hp_intake_summary?.length ? (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "18px",
                  fontSize: "12px",
                  color: "#1F2937",
                }}
              >
                {summary.hp_intake_summary.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            ) : (
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: "#4B5563",
                }}
              >
                No structured intake bullets generated.
              </p>
            )}

            <h4
              style={{
                margin: "10px 0 4px",
                fontSize: "13px",
                color: "#0F172A",
              }}
            >
              Brief assessment
            </h4>
            <p
              style={{
                margin: "0 0 6px",
                fontSize: "13px",
                color: "#111827",
              }}
            >
              {summary?.hp_assessment_brief ||
                "No brief H&P assessment generated yet."}
            </p>

            <h4
              style={{
                margin: "8px 0 4px",
                fontSize: "13px",
                color: "#0F172A",
              }}
            >
              Problem list (encounter)
            </h4>
            {summary?.encounter_problem_list?.length ? (
              <ol
                style={{
                  margin: 0,
                  paddingLeft: "20px",
                  fontSize: "12px",
                  color: "#1F2937",
                }}
              >
                {summary.encounter_problem_list.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ol>
            ) : (
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: "#4B5563",
                }}
              >
                No structured problem list generated.
              </p>
            )}
          </>
        );
      case "progress":
        return (
          <>
            <h4
              style={{
                margin: "0 0 6px",
                fontSize: "13px",
                color: "#0F172A",
              }}
            >
              Progress note
            </h4>
            {summary?.progress_note_summary?.length ? (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "18px",
                  fontSize: "12px",
                  color: "#1F2937",
                }}
              >
                {summary.progress_note_summary.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            ) : summary?.hospital_course?.length ? (
              <>
                <p
                  style={{
                    margin: "0 0 4px",
                    fontSize: "12px",
                    color: "#4B5563",
                  }}
                >
                  No dedicated progress bullets; showing hospital course
                  bullets instead.
                </p>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: "18px",
                    fontSize: "12px",
                    color: "#1F2937",
                  }}
                >
                  {summary.hospital_course.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: "#4B5563",
                }}
              >
                No progress‑note style summary generated.
              </p>
            )}

            <h4
              style={{
                margin: "10px 0 4px",
                fontSize: "13px",
                color: "#0F172A",
              }}
            >
              Brief assessment (today)
            </h4>
            <p
              style={{
                margin: "0 0 6px",
                fontSize: "13px",
                color: "#111827",
              }}
            >
              {summary?.progress_assessment_brief ||
                "No brief progress assessment generated yet."}
            </p>

            <h4
              style={{
                margin: "8px 0 4px",
                fontSize: "13px",
                color: "#0F172A",
              }}
            >
              Problem list (encounter)
            </h4>
            {summary?.encounter_problem_list?.length ? (
              <ol
                style={{
                  margin: 0,
                  paddingLeft: "20px",
                  fontSize: "12px",
                  color: "#1F2937",
                }}
              >
                {summary.encounter_problem_list.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ol>
            ) : (
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: "#4B5563",
                }}
              >
                No structured problem list generated.
              </p>
            )}
          </>
        );
      case "coding":
        return (
          <>
            <h4
              style={{
                margin: "0 0 6px",
                fontSize: "13px",
                color: "#0F172A",
              }}
            >
              Coding diagnoses
            </h4>
            <p
              style={{
                margin: "0 0 6px",
                fontSize: "13px",
                color: "#111827",
              }}
            >
              <strong>Principal:</strong>{" "}
              {coding?.principal_diagnosis ||
                "No principal diagnosis available."}
            </p>
            {coding?.secondary_diagnoses?.length ? (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "18px",
                  fontSize: "12px",
                  color: "#1F2937",
                }}
              >
                {coding.secondary_diagnoses.map((dx, idx) => (
                  <li key={idx}>{dx}</li>
                ))}
              </ul>
            ) : (
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: "#4B5563",
                }}
              >
                No secondary diagnoses returned.
              </p>
            )}
          </>
        );
      case "insights":
        return (
          <>
            <h4
              style={{
                margin: "0 0 6px",
                fontSize: "13px",
                color: "#0F172A",
              }}
            >
              Discharge insights
            </h4>
            {summary?.insights?.length ? (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "18px",
                  fontSize: "12px",
                  color: "#1F2937",
                }}
              >
                {summary.insights.map((it, idx) => (
                  <li key={idx}>{it}</li>
                ))}
              </ul>
            ) : (
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: "#4B5563",
                }}
              >
                No discharge planning insights generated.
              </p>
            )}
          </>
        );
      case "problem_insights":
        return (
          <>
            <h4
              style={{
                margin: "0 0 6px",
                fontSize: "13px",
                color: "#0F172A",
              }}
            >
              Problem‑list insights
            </h4>
            {summary?.problem_list_insights?.length ? (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "18px",
                  fontSize: "12px",
                  color: "#1F2937",
                }}
              >
                {summary.problem_list_insights.map((it, idx) => (
                  <li key={idx}>{it}</li>
                ))}
              </ul>
            ) : (
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: "#4B5563",
                }}
              >
                No problem‑list insights generated.
              </p>
            )}
          </>
        );
      case "training":
        return (
          <>
            <h4
              style={{
                margin: "0 0 6px",
                fontSize: "13px",
                color: "#0F172A",
              }}
            >
              Azense for Residents
            </h4>
            {!training ? (
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: "#4B5563",
                }}
              >
                Click “Explain this note” to generate resident‑facing reasoning
                for this case.
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  fontSize: "12px",
                  color: "#111827",
                }}
              >
                <div>
                  <strong>H&P assessment – how Azense got there</strong>
                  <p style={{ margin: "2px 0 0" }}>
                    {training.hp_assessment_explanation}
                  </p>
                </div>
                <div>
                  <strong>Progress brief – what changed today</strong>
                  <p style={{ margin: "2px 0 0" }}>
                    {training.progress_assessment_explanation}
                  </p>
                </div>
                <div>
                  <strong>Coding and problem list – attending commentary</strong>
                  <p style={{ margin: "2px 0 0" }}>
                    {training.coding_overview}
                  </p>
                </div>
                {training.problem_explanations?.length > 0 && (
                  <div>
                    <strong>Key problems – evidence and phrasing</strong>
                    <div
                      style={{
                        marginTop: "4px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      {training.problem_explanations.map((p, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: "4px 6px",
                            borderRadius: "6px",
                            border: "1px solid rgba(15,23,42,0.12)",
                            backgroundColor: "#F9FAFB",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              marginBottom: "2px",
                            }}
                          >
                            {p.problem}
                          </div>
                          <div style={{ marginBottom: "2px" }}>
                            {p.why_it_applies}
                          </div>
                          {p.supporting_data?.length > 0 && (
                            <ul
                              style={{
                                margin: "0 0 2px",
                                paddingLeft: "16px",
                              }}
                            >
                              {p.supporting_data.map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          )}
                          <div
                            style={{
                              fontStyle: "italic",
                              color: "#4B5563",
                            }}
                          >
                            {p.how_to_document}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        );
      default:
        return null;
    }
  };

  const TAB_STYLES = {
    dc_draft: {
      baseBg: "rgba(14,165,233,0.18)",
      baseBorder: "rgba(14,165,233,0.60)",
      baseText: "#0369A1",
    },
    hp: {
      baseBg: "rgba(129,140,248,0.20)",
      baseBorder: "rgba(79,70,229,0.60)",
      baseText: "#3730A3",
    },
    progress: {
      baseBg: "rgba(249,115,22,0.18)",
      baseBorder: "rgba(234,88,12,0.60)",
      baseText: "#9A3412",
    },
    coding: {
      baseBg: "rgba(244,63,94,0.18)",
      baseBorder: "rgba(225,29,72,0.60)",
      baseText: "#9F1239",
    },
    insights: {
      baseBg: "rgba(34,197,94,0.18)",
      baseBorder: "rgba(22,163,74,0.60)",
      baseText: "#166534",
    },
    problem_insights: {
      baseBg: "rgba(56,189,248,0.18)",
      baseBorder: "rgba(8,145,178,0.60)",
      baseText: "#0E7490",
    },
    training: {
      baseBg: "rgba(196,181,253,0.22)",
      baseBorder: "rgba(129,140,248,0.80)",
      baseText: "#4C1D95",
    },
  };

  const tabButton = (id, label) => {
    const active = activeView === id;
    const palette = TAB_STYLES[id];
    const activeBg = `linear-gradient(135deg, ${palette.baseBg}, rgba(255,255,255,0.02))`;

    return (
      <button
        key={id}
        onClick={() => setActiveView(id)}
        style={{
          padding: "5px 11px",
          borderRadius: "999px",
          border: `1px solid ${palette.baseBorder}`,
          background: active ? activeBg : palette.baseBg,
          color: palette.baseText,
          fontSize: "11px",
          fontWeight: active ? 800 : 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
          boxShadow: active
            ? "0 4px 12px rgba(15,23,42,0.28)"
            : "0 1px 3px rgba(15,23,42,0.12)",
          transform: active ? "translateY(-1px)" : "translateY(0)",
          transition:
            "background-color 120ms ease, box-shadow 120ms ease, transform 80ms ease",
        }}
      >
        {label}
      </button>
    );
  };

  // LOGIN GATE
  if (!loggedIn) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at top, #E2F2F0 0, #E9F0FB 45%, #D7E2F7 100%)",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 380,
            backgroundColor: "white",
            borderRadius: 16,
            padding: 24,
            boxShadow:
              "0 24px 60px rgba(15,23,42,0.28), 0 0 0 1px rgba(15,23,42,0.08)",
            border: "1px solid rgba(148,163,184,0.4)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <img
              src={AzenseLogo}
              alt="AZense logo"
              style={{ height: 50, marginBottom: 8 }}
            />
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#0F172A",
              }}
            >
              Sign in to AZense
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#6B7280",
                marginTop: 4,
              }}
            >
              Private prototype access
            </div>
          </div>

          <form
            onSubmit={handleLogin}
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 4,
                  color: "#4B5563",
                }}
              >
                Username
              </label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                style={{
                  width: "100%",
                  borderRadius: 10,
                  border: "1px solid rgba(148,163,184,0.9)",
                  padding: "7px 9px",
                  fontSize: 13,
                  outline: "none",
                  backgroundColor: "#F9FAFB",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 4,
                  color: "#4B5563",
                }}
              >
                Password
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                style={{
                  width: "100%",
                  borderRadius: 10,
                  border: "1px solid rgba(148,163,184,0.9)",
                  padding: "7px 9px",
                  fontSize: 13,
                  outline: "none",
                  backgroundColor: "#F9FAFB",
                }}
              />
            </div>

            {loginError && (
              <div
                style={{
                  fontSize: 12,
                  color: "#B91C1C",
                }}
              >
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              style={{
                marginTop: 4,
                width: "100%",
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid rgba(15,23,42,0.9)",
                background:
                  "linear-gradient(135deg, #020617 0%, #111827 40%, #020617 100%)",
                color: "#F9FAFB",
                fontWeight: 600,
                fontSize: 13,
                cursor: loginLoading ? "wait" : "pointer",
                opacity: loginLoading ? 0.85 : 1,
              }}
            >
              {loginLoading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div
            style={{
              marginTop: 10,
              fontSize: 11,
              color: "#9CA3AF",
              textAlign: "center",
            }}
          >
            Share this username/password only with trusted colleagues.
          </div>
        </div>
      </div>
    );
  }

  // MAIN APP RENDER
  return (
    <div
      style={{
        minHeight: "100vh",
        margin: 0,
        padding: 0,
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        backgroundImage: `
          radial-gradient(circle at top, #E2F2F0 0, #E9F0FB 45%, #D7E2F7 100%),
          url(${AzenseLogo})
        `,
        backgroundRepeat: "no-repeat, no-repeat",
        backgroundPosition: "center top 60px, center 60px",
        backgroundSize: "cover, 1000px auto",
        filter: "brightness(0.96) saturate(0.9)",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "40px 16px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: "1280px",
          backgroundColor: "rgba(255,255,255,0.985)",
          borderRadius: "20px",
          padding: "24px 28px 30px",
          boxShadow:
            "0 26px 70px rgba(4, 23, 51, 0.32), 0 0 0 1px rgba(4, 23, 51, 0.10)",
          border: "1px solid rgba(4, 23, 51, 0.20)",
          backdropFilter: "blur(2px)",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "18px",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <img
              src={AzenseLogo}
              alt="AZense logo"
              style={{ height: "64px", width: "auto", display: "block" }}
            />
            <div
              style={{
                fontSize: "12px",
                color: "#334155",
              }}
            >
              Signal‑first rounding companion
            </div>
          </div>

          <div
            style={{
              padding: "4px 10px",
              borderRadius: "999px",
              border: "1px solid rgba(0, 194, 174, 0.75)",
              background:
                "linear-gradient(120deg, rgba(0,194,174,0.18), rgba(53,217,119,0.14))",
              fontSize: "11px",
              fontWeight: 600,
              color: "#064E3B",
              whiteSpace: "nowrap",
            }}
          >
            Internal medicine · MVP
          </div>
        </header>

        <div
          style={{
            height: "1px",
            width: "100%",
            background:
              "linear-gradient(90deg, rgba(4,23,51,0) 0%, rgba(0,194,174,0.95) 50%, rgba(4,23,51,0) 100%)",
            marginBottom: "18px",
          }}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1.4fr)",
            gap: "20px",
          }}
        >
          {/* LEFT COLUMN */}
          <section>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#475569",
                marginBottom: "6px",
              }}
            >
              Patient context
            </div>

            <div
              style={{
                display: "flex",
                gap: "8px",
                marginBottom: "10px",
                flexWrap: "wrap",
              }}
            >
              <input
                placeholder="Patient id (1–24)"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: "180px",
                  borderRadius: "10px",
                  border: "1px solid rgba(15,23,42,0.26)",
                  padding: "7px 9px",
                  fontSize: "13px",
                  outline: "none",
                  backgroundColor: "#F8FAFC",
                  color: "#0F172A",
                }}
              />
              <input
                placeholder="Hospital day (optional)"
                style={{
                  width: "140px",
                  borderRadius: "10px",
                  border: "1px solid rgba(15,23,42,0.26)",
                  padding: "7px 9px",
                  fontSize: "13px",
                  outline: "none",
                  backgroundColor: "#F8FAFC",
                  color: "#0F172A",
                }}
              />
            </div>

            <div
              style={{
                marginTop: "4px",
                marginBottom: "8px",
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <button
                onClick={startEpicAuth}
                style={{
                  padding: "6px 14px",
                  borderRadius: "999px",
                  border: "1px solid rgba(37,99,235,0.9)",
                  background:
                    "linear-gradient(135deg, #2563EB 0%, #3B82F6 40%, #60A5FA 100%)",
                  color: "#F9FAFB",
                  fontWeight: 600,
                  fontSize: "12px",
                  boxShadow: "0 10px 24px rgba(37,99,235,0.45)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Connect to EPIC (sandbox)
              </button>
              {epicStatus && (
                <span
                  style={{
                    fontSize: "11px",
                    color: "#1D4ED8",
                  }}
                >
                  {epicStatus}
                </span>
              )}
            </div>

            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "#1F2937",
                marginBottom: "4px",
              }}
            >
              Free-text chart paste (UI only for now)
            </label>
            <textarea
              rows={10}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Optional: paste labs, vitals, imaging impressions, consultant notes, hospital course…"
              style={{
                width: "100%",
                borderRadius: "12px",
                border: "1px solid rgba(15,23,42,0.26)",
                padding: "9px 10px",
                fontSize: "13px",
                resize: "vertical",
                outline: "none",
                background:
                  "linear-gradient(145deg, #F9FAFB 0%, #EEF2FF 40%, #FFFFFF 100%)",
                color: "#0F172A",
              }}
            />

            {errorText && (
              <div
                style={{
                  marginTop: "8px",
                  fontSize: "12px",
                  color: "#B91C1C",
                }}
              >
                {errorText}
              </div>
            )}

            <div
              style={{
                marginTop: "6px",
                marginBottom: "6px",
                fontSize: "11px",
                color: "#374151",
                display: "flex",
                flexWrap: "wrap",
                gap: "8px 16px",
              }}
            >
              <span style={{ fontWeight: 600 }}>Generate:</span>

              <label
                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <input
                  type="checkbox"
                  checked={wantSummary}
                  onChange={(e) => setWantSummary(e.target.checked)}
                />
                <span>Discharge summary</span>
              </label>

              <label
                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <input
                  type="checkbox"
                  checked={wantHp}
                  onChange={(e) => setWantHp(e.target.checked)}
                />
                <span>H&P / progress</span>
              </label>

              <label
                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <input
                  type="checkbox"
                  checked={wantCoding}
                  onChange={(e) => setWantCoding(e.target.checked)}
                />
                <span>Coding dx</span>
              </label>

              <label
                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <input
                  type="checkbox"
                  checked={wantInsights}
                  onChange={(e) => setWantInsights(e.target.checked)}
                />
                <span>DC insights</span>
              </label>

              <label
                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <input
                  type="checkbox"
                  checked={wantProblemInsights}
                  onChange={(e) =>
                    setWantProblemInsights(e.target.checked)
                  }
                />
                <span>Problem-list insights</span>
              </label>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "10px",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  color: "#6B7280",
                }}
              >
                Use “Azense for Residents” to see how the model assembled its
                assessment and coding from the data.
              </div>
              <button
                onClick={runAzense}
                disabled={loading}
                style={{
                  padding: "8px 16px",
                  borderRadius: "999px",
                  border: "1px solid rgba(4,120,87,0.9)",
                  background:
                    "linear-gradient(135deg, #059669 0%, #16A34A 40%, #22C55E 100%)",
                  color: "#F9FAFB",
                  fontWeight: 700,
                  fontSize: "13px",
                  boxShadow: "0 12px 28px rgba(5,150,105,0.45)",
                  cursor: loading ? "wait" : "pointer",
                  opacity: loading ? 0.85 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {loading ? "Running AZense…" : "Run AZense"}
              </button>
              <button
                onClick={runTraining}
                disabled={trainingLoading || !summary}
                style={{
                  padding: "7px 14px",
                  borderRadius: "999px",
                  border: "1px solid rgba(79,70,229,0.9)",
                  background:
                    "linear-gradient(135deg, #4F46E5 0%, #6366F1 40%, #818CF8 100%)",
                  color: "#F9FAFB",
                  fontWeight: 600,
                  fontSize: "12px",
                  boxShadow: "0 10px 24px rgba(79,70,229,0.45)",
                  cursor:
                    trainingLoading || !summary ? "not-allowed" : "pointer",
                  opacity: trainingLoading || !summary ? 0.7 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {trainingLoading
                  ? "Loading Resident view…"
                  : "Azense for Residents"}
              </button>
            </div>

            {/* Chat panel under all left column content */}
            <ChatPanel />
          </section>

          {/* RIGHT COLUMN */}
          <section
            style={{
              borderRadius: "14px",
              border: "1px solid rgba(15,23,42,0.18)",
              background:
                "linear-gradient(155deg, rgba(15,23,42,0.04), rgba(0,194,174,0.06))",
              padding: "10px 11px 11px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                marginBottom: "8px",
              }}
            >
              {tabButton("dc_draft", "Discharge")}
              {tabButton("hp", "H&P")}
              {tabButton("progress", "Progress note")}
              {tabButton("coding", "Coding")}
              {tabButton("insights", "Discharge insights")}
              {tabButton("problem_insights", "Problem list insights")}
              {tabButton("training", "Azense for Residents")}
            </div>

            <div
              style={{
                flex: 1,
                borderRadius: "10px",
                border: "1px solid rgba(15,23,42,0.22)",
                backgroundColor: "#FFFFFF",
                padding: "9px 10px",
                fontSize: "13px",
                color: "#111827",
                overflowY: "auto",
                minHeight: "220px",
              }}
            >
              {renderOutput()}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
import { Routes, Route } from "react-router-dom";
import EpicLaunch from "./EpicLaunch";
import Home from "./Home";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/epic-launch" element={<EpicLaunch />} />
    </Routes>
  );
}

export default App;
