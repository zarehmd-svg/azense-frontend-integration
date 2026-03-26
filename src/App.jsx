// src/App.jsx
import { useState, useEffect } from "react";
import AzenseLogo from "./assets/Azense-logo.png";
import { ChatPanel } from "./components/ChatPanel";
import CernerLaunch from "./CernerLaunch";

const API_BASE =
  import.meta.env.VITE_API_BASE || "https://azense-backend.onrender.com";

function formatDischargeSummary(text) {
  if (!text) return "";

  let cleaned = text.replace(/[#*`]/g, "");
  const lines = cleaned.split("\n");

  const processed = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return "";

    const isNumbered = /^[0-9]+\./.test(trimmed);
    const isAllCapsHeading =
      trimmed === trimmed.toUpperCase() &&
      trimmed.length > 3 &&
      !/[0-9]/.test(trimmed);

    if (isNumbered || isAllCapsHeading) {
      return `<strong>${trimmed}</strong>`;
    }

    return trimmed;
  });

  return processed.join("<br/>");
}

function AppInner() {
  const [loggedIn, setLoggedIn] = useState(
    () => window.localStorage.getItem("azense_logged_in") === "true"
  );
  const [loginError, setLoginError] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [patientId, setPatientId] = useState("1");
  const [input, setInput] = useState("");
  const [summary, setSummary] = useState(null);
  const [coding, setCoding] = useState(null);
  const [training, setTraining] = useState(null);
  const [loading, setLoading] = useState(false);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [activeView, setActiveView] = useState("hp");

  const [wantSummary, setWantSummary] = useState(true);
  const [wantHp, setWantHp] = useState(true);
  const [wantCoding, setWantCoding] = useState(true);
  const [wantInsights, setWantInsights] = useState(true);
  const [wantProblemInsights, setWantProblemInsights] = useState(true);

  const [cernerStatus, setCernerStatus] = useState("");
  const [cernerContext, setCernerContext] = useState(null);

  useEffect(() => {
    const loadCernerContext = async () => {
      try {
        const res = await fetch(`${API_BASE}/cerner/context`);
        if (!res.ok) return;
        const json = await res.json();
        setCernerContext(json);
      } catch {
        // ignore if none
      }
    };
    loadCernerContext();
  }, []);

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

  const startCernerAuth = async () => {
    setCernerStatus(
      "Use Cerner test launch; SMART EHR launch now goes through /cerner-launch."
    );
  };

  const runAzense = async () => {
    setErrorText("");
    setLoading(true);
    setSummary(null);
    setCoding(null);
    setTraining(null);

    try {
      const useCerner = !!cernerContext;

      const summaryUrl = useCerner
        ? `${API_BASE}/cerner/generate-summary`
        : `${API_BASE}/generate-summary?patient_id=${encodeURIComponent(
            patientId || "1"
          )}` +
          `&do_summary=${wantSummary}` +
          `&do_hp=${wantHp}` +
          `&do_coding=${wantCoding}` +
          `&do_insights=${wantInsights}` +
          `&do_problem_insights=${wantProblemInsights}`;

      const summaryRes = await fetch(summaryUrl, { method: "POST" });
      if (!summaryRes.ok) {
        throw new Error(`Summary error: ${summaryRes.status}`);
      }
      const summaryJson = await summaryRes.json();

      console.log("SUMMARY JSON FROM BACKEND", summaryJson);

      let codingJson = null;
      if (wantCoding && !useCerner) {
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
    if (!summary) return;
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
    console.log("SUMMARY FROM BACKEND", summary);
    if (!summary && !coding) {
      return (
        <p style={{ margin: 0, color: "#4B5563", fontSize: "12px" }}>
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
              style={{ margin: "0 0 6px", fontSize: "13px", color: "#0F172A" }}
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
              style={{ margin: "0 0 6px", fontSize: "13px", color: "#0F172A" }}
            >
              H&P assessment
            </h4>

            {/* Brief assessment on top */}
            {summary?.hp_assessment_brief && (
              <p
                style={{
                  margin: "0 0 6px",
                  fontSize: "13px",
                  color: "#111827",
                  fontWeight: 600,
                }}
              >
                {summary.hp_assessment_brief}
              </p>
            )}

            {/* Full assessment */}
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

            {/* Problem list */}
            {summary?.encounter_problem_list?.length > 0 && (
              <div style={{ marginTop: "4px" }}>
                <h5
                  style={{
                    margin: "0 0 4px",
                    fontSize: "12px",
                    color: "#0F172A",
                    fontWeight: 600,
                  }}
                >
                  Problem list
                </h5>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: "18px",
                    fontSize: "12px",
                    color: "#1F2937",
                  }}
                >
                  {summary.encounter_problem_list.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        );
      case "progress":
        return (
          <>
            <h4
              style={{ margin: "0 0 6px", fontSize: "13px", color: "#0F172A" }}
            >
              Progress note
            </h4>

            {/* Brief progress assessment */}
            {summary?.progress_assessment_brief && (
              <p
                style={{
                  margin: "0 0 6px",
                  fontSize: "13px",
                  color: "#111827",
                  fontWeight: 600,
                }}
              >
                {summary.progress_assessment_brief}
              </p>
            )}

            {/* Progress bullets */}
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
            ) : (
              <p style={{ margin: 0, fontSize: "12px", color: "#4B5563" }}>
                No progress‑note style summary generated.
              </p>
            )}
          </>
        );
      case "coding":
        return (
          <>
            <h4
              style={{ margin: "0 0 6px", fontSize: "13px", color: "#0F172A" }}
            >
              Coding diagnoses
            </h4>
            <p
              style={{ margin: "0 0 6px", fontSize: "13px", color: "#111827" }}
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
              <p style={{ margin: 0, fontSize: "12px", color: "#4B5563" }}>
                No secondary diagnoses returned.
              </p>
            )}
          </>
        );
      case "insights":
        return (
          <>
            <h4
              style={{ margin: "0 0 6px", fontSize: "13px", color: "#0F172A" }}
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
              <p style={{ margin: 0, fontSize: "12px", color: "#4B5563" }}>
                No discharge planning insights generated.
              </p>
            )}
          </>
        );
      case "training":
  return (
    <>
      <h4
        style={{ margin: "0 0 6px", fontSize: "13px", color: "#0F172A" }}
      >
        Azense for Residents
      </h4>
      {!training ? (
        <p style={{ margin: 0, fontSize: "12px", color: "#4B5563" }}>
          Click “Explain this note” to generate resident‑facing reasoning
          for this case.
        </p>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
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

          {training.coding_diagnoses_explanation && (
            <div>
              <strong>Coding diagnoses – teaching points</strong>
              <p style={{ margin: "2px 0 0" }}>
                {training.coding_diagnoses_explanation}
              </p>
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
        }}
      >
        {label}
      </button>
    );
  };

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
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <img
              src={AzenseLogo}
              alt="AZense logo"
              style={{ height: 50, marginBottom: 8 }}
            />
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>
              Sign in to AZense
            </div>
          </div>

          <form
            onSubmit={handleLogin}
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <input
              type="text"
              placeholder="Username"
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              style={{
                width: "100%",
                borderRadius: 10,
                border: "1px solid rgba(148,163,184,0.9)",
                padding: "7px 9px",
                fontSize: 13,
                backgroundColor: "#F9FAFB",
              }}
            />
            <input
              type="password"
              placeholder="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              style={{
                width: "100%",
                borderRadius: 10,
                border: "1px solid rgba(148,163,184,0.9)",
                padding: "7px 9px",
                fontSize: 13,
                backgroundColor: "#F9FAFB",
              }}
            />

            {loginError && (
              <div style={{ fontSize: 12, color: "#B91C1C" }}>{loginError}</div>
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
              }}
            >
              {loginLoading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "40px 16px",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        backgroundImage: `
          radial-gradient(circle at top, #E2F2F0 0, #E9F0FB 45%, #D7E2F7 100%),
          url(${AzenseLogo})
        `,
        backgroundRepeat: "no-repeat, no-repeat",
        backgroundPosition: "center top 60px, center 60px",
        backgroundSize: "cover, 1000px auto",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1280px",
          backgroundColor: "rgba(255,255,255,0.985)",
          borderRadius: "20px",
          padding: "24px 28px 30px",
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
            <div style={{ fontSize: "12px", color: "#334155" }}>
              Signal‑first rounding companion
            </div>
            {cernerContext?.patient_resource && (
              <div
                style={{
                  marginTop: 4,
                  padding: "3px 8px",
                  borderRadius: 999,
                  border: "1px solid rgba(37,99,235,0.7)",
                  backgroundColor: "rgba(59,130,246,0.06)",
                  fontSize: 11,
                  color: "#1D4ED8",
                }}
              >
                {(() => {
                  const p = cernerContext.patient_resource;
                  const nameObj = p.name && p.name[0];
                  const name =
                    (nameObj &&
                      (nameObj.text ||
                        `${nameObj.family || ""}, ${
                          (nameObj.given && nameObj.given[0]) || ""
                        }`)) ||
                    "Unknown";
                  const dob = p.birthDate || "Unknown DOB";
                  return `Cerner patient: ${name} · DOB ${dob} · ID ${p.id}`;
                })()}
              </div>
            )}
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
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1.4fr)",
            gap: "20px",
          }}
        >
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
                onClick={startCernerAuth}
                style={{
                  padding: "6px 14px",
                  borderRadius: "999px",
                  border: "1px solid rgba(37,99,235,0.9)",
                  background:
                    "linear-gradient(135deg, #2563EB 0%, #3B82F6 40%, #60A5FA 100%)",
                  color: "#F9FAFB",
                  fontWeight: 600,
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                Connect to Cerner (sandbox)
              </button>
              {cernerStatus && (
                <span style={{ fontSize: "11px", color: "#1D4ED8" }}>
                  {cernerStatus}
                </span>
              )}
            </div>

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
                style={{ marginTop: "8px", fontSize: "12px", color: "#B91C1C" }}
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
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <input
                  type="checkbox"
                  checked={wantSummary}
                  onChange={(e) => setWantSummary(e.target.checked)}
                />
                <span>Discharge summary</span>
              </label>

              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <input
                  type="checkbox"
                  checked={wantHp}
                  onChange={(e) => setWantHp(e.target.checked)}
                />
                <span>H&P / progress</span>
              </label>

              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <input
                  type="checkbox"
                  checked={wantCoding}
                  onChange={(e) => setWantCoding(e.target.checked)}
                  disabled={!!cernerContext}
                />
                <span>Coding dx</span>
              </label>

              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <input
                  type="checkbox"
                  checked={wantInsights}
                  onChange={(e) => setWantInsights(e.target.checked)}
                />
                <span>DC insights</span>
              </label>

              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
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
                  cursor: loading ? "wait" : "pointer",
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
                  cursor:
                    trainingLoading || !summary ? "not-allowed" : "pointer",
                  opacity: trainingLoading || !summary ? 0.7 : 1,
                }}
              >
                {trainingLoading
                  ? "Loading Resident view…"
                  : "Azense for Residents"}
              </button>
            </div>

            <ChatPanel />
          </section>

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

function App() {
  if (window.location.pathname === "/cerner-launch") {
    return <CernerLaunch />;
  }
  return <AppInner />;
}

export default App;
