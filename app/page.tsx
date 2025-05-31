"use client";
import { useRef, useState, useEffect } from "react";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, provider } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

const TABS = ["All", "My Uni", "Tech", "Finance", "Trending"];
const storage = getStorage();

export default function ResumeHub() {
  const fileInputRef = useRef(null);
  const [resumes, setResumes] = useState([]);
  const [selectedResume, setSelectedResume] = useState(null);
  const [comments, setComments] = useState({});
  const [newComments, setNewComments] = useState({});
  const [tab, setTab] = useState(TABS[0]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return () => unsub();
  }, []);

  // Auth
  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      alert("Sign in failed: " + err.message);
    }
  };
  const handleSignOut = async () => {
    await signOut(auth);
  };

  // Upload
  const handleUploadClick = () => {
    if (user) fileInputRef.current.click();
    else alert("Please sign in to upload resumes.");
  };
  const handleFileChange = async (e) => {
    if (e.target.files.length > 0 && user) {
      const file = e.target.files[0];
      const id = `resume-${Date.now()}`;
      setResumes((prev) => [
        ...prev,
        {
          id,
          name: file.name,
          uploadedBy: user.displayName || "You",
          uploadedAt: new Date().toLocaleString(),
          status: "Uploading...",
        },
      ]);
      try {
        const storageRef = ref(storage, `resumes/${id}_${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        setResumes((prev) =>
          prev.map((r) => (r.id === id ? { ...r, url, status: "Uploaded" } : r))
        );
      } catch (err) {
        alert("Upload failed: " + err.message);
        setResumes((prev) => prev.filter((r) => r.id !== id));
      }
      e.target.value = "";
    }
  };

  // Comments (local state for demo)
  const handleAddComment = (resumeId) => {
    if (!user) {
      alert("Sign in to comment!");
      return;
    }
    const text = newComments[resumeId]?.trim();
    if (!text) return;
    setComments((prev) => ({
      ...prev,
      [resumeId]: [
        ...(prev[resumeId] || []),
        { user: user.displayName || "You", text, timestamp: "now", upvotes: 0 },
      ],
    }));
    setNewComments((prev) => ({ ...prev, [resumeId]: "" }));
  };

  // === MAIN FEED (not viewing a resume) ===
  if (!selectedResume) {
    return (
      <main className="min-h-screen bg-[#f7f9fb] flex flex-col items-center">
        <div className="w-full max-w-5xl p-6">
          {/* Header */}
          <header className="w-full flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-blue-700">ResumeHub</h1>
            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <img
                    src={user.photoURL || ""}
                    alt="profile"
                    className="w-8 h-8 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                  <span className="text-gray-700">{user.displayName}</span>
                  <button
                    className="text-blue-600 font-medium hover:underline ml-4"
                    onClick={handleSignOut}
                  >
                    Logout
                  </button>
                </>
              ) : (
                <button
                  className="text-blue-600 font-medium hover:underline ml-4"
                  onClick={handleGoogleSignIn}
                >
                  Sign In
                </button>
              )}
            </div>
          </header>

          {/* Hero Card */}
          <section className="bg-white rounded-2xl shadow-lg px-8 py-10 mb-10 text-center max-w-2xl mx-auto">
            <h2 className="text-4xl font-bold text-gray-900 mb-3">
              Upload. Share. Get Feedback.
              <br />
              <span className="text-3xl font-bold text-blue-700">
                Land your dream job.
              </span>
            </h2>
            <p className="text-gray-600 mb-8">
              A community to roast and improve your resume.
            </p>
            <div className="flex justify-center gap-4 mb-8 flex-wrap">
              <button
                onClick={handleUploadClick}
                className={`px-6 py-3 rounded-xl font-semibold text-base transition shadow ${
                  user
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
                title={user ? "Upload your resume!" : "Sign in to upload"}
              >
                Upload Resume
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf"
                style={{ display: "none" }}
              />
            </div>
            {/* Tab Bar */}
            <nav className="mb-6">
              <ul className="flex gap-5 justify-center border-b border-gray-200">
                {TABS.map((t) => (
                  <li key={t}>
                    <button
                      className={`pb-2 font-medium ${
                        tab === t
                          ? "text-blue-600 border-b-2 border-blue-500"
                          : "text-gray-500 hover:text-blue-500"
                      }`}
                      onClick={() => setTab(t)}
                    >
                      {t}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </section>

          {/* Feed */}
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-4 text-gray-700">
              Recent Resume Uploads
            </h3>
            <div className="space-y-6">
              {resumes.length === 0 && (
                <div className="text-gray-500 text-center py-16">
                  No resumes uploaded yet.
                </div>
              )}
              {resumes.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between border-b py-5"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      {/* User Icon */}
                      <svg
                        width="32"
                        height="32"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle cx="12" cy="8" r="4" fill="#E5E7EB" />
                        <ellipse cx="12" cy="17" rx="7" ry="5" fill="#E5E7EB" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {r.uploadedBy}
                      </div>
                      <div className="text-gray-700">{r.name}</div>
                      <div className="text-xs text-gray-400">
                        {(comments[r.id] || []).length} Comments
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedResume(r)}
                    className="text-blue-600 font-medium hover:underline text-base"
                  >
                    View Resume
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <footer className="mt-16 text-gray-400 text-sm flex gap-6 justify-center w-full mb-8">
            <a href="#" className="hover:text-blue-500">
              About
            </a>
            <a href="#" className="hover:text-blue-500">
              Privacy
            </a>
            <a href="#" className="hover:text-blue-500">
              Contact
            </a>
          </footer>
        </div>
      </main>
    );
  }

  // === RESUME DETAIL VIEW ===
  const r = selectedResume;
  const resumeComments = comments[r.id] || [];

  return (
    <main className="min-h-screen bg-[#f7f9fb] flex flex-col items-center">
      <header className="w-full px-8 py-6 bg-white shadow-sm flex justify-between items-center">
        <button
          onClick={() => setSelectedResume(null)}
          className="text-blue-600 hover:underline"
        >
          ← Back to Feed
        </button>
        {user ? (
          <span
            className="text-blue-500 cursor-pointer"
            onClick={handleSignOut}
          >
            Logout
          </span>
        ) : (
          <button
            className="text-blue-600 font-medium hover:underline ml-4"
            onClick={handleGoogleSignIn}
          >
            Sign In
          </button>
        )}
      </header>
      <section className="w-full max-w-2xl mt-10 mb-6 p-8 text-blue-500 rounded-2xl shadow-lg">
        <div className="flex items-center gap-4 mb-6">
          <img
            src={user?.photoURL || ""}
            alt="profile"
            className="w-14 h-14 rounded-full"
            referrerPolicy="no-referrer"
          />
          <div>
            <h1 className="text-2xl font-bold">{r.name}</h1>
          </div>
        </div>
        <div className="mb-6">
          <iframe
            src={r.url}
            className="w-full h-[600px] border rounded"
            title="Resume PDF Preview"
          />
        </div>
        <div className="flex gap-4 mb-8">
          <a
            href={r.url}
            download={r.name}
            className="px-5 py-2 bg-blue-600 text-white rounded font-semibold"
          >
            Download Resume
          </a>
        </div>
        <h3 className="text-xl text-red-600 font-semibold mb-4">
          Comments & Feedback
        </h3>
        <div className="space-y-4 mb-4">
          {resumeComments.length === 0 && (
            <div className="text-blue-500">No comments yet.</div>
          )}
          {resumeComments.map((c, i) => (
            <div
              key={i}
              className="bg-gray-50 rounded p-3 shadow-sm flex flex-col gap-1"
            >
              <div className="font-medium flex items-center gap-2">
                <span>{c.user}</span>
                <span className="text-xs text-gray-400">{c.timestamp}</span>
              </div>
              <div className="text-gray-700">{c.text}</div>
              <div className="text-xs text-gray-500">
                {c.upvotes > 0 && `↑ ${c.upvotes} upvotes`}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            className="flex-1 border rounded p-2"
            value={newComments[r.id] || ""}
            onChange={(e) =>
              setNewComments((prev) => ({ ...prev, [r.id]: e.target.value }))
            }
            placeholder={
              user ? "Add a comment..." : "Sign in to add a comment..."
            }
            disabled={!user}
          />
          <button
            onClick={() => handleAddComment(r.id)}
            className={`px-4 py-2 rounded ${
              user
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
            disabled={!user}
          >
            Submit
          </button>
        </div>
      </section>
      <footer className="mt-16 text-gray-400 text-sm flex gap-6 justify-center w-full mb-8">
        <a href="#" className="hover:text-blue-500">
          About
        </a>
        <a href="#" className="hover:text-blue-500">
          Privacy
        </a>
        <a href="#" className="hover:text-blue-500">
          Contact
        </a>
      </footer>
    </main>
  );
}
