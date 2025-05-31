"use client";
import { useRef, useState, useEffect } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, provider, storage, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import type { DocumentData } from "firebase/firestore";
import { Timestamp } from "firebase/firestore";
import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";

type Resume = {
  id: string;
  name: string;
  uploadedBy: string;
  uploadedAt: any; // Or Date|string
  url: string;
  status?: string;
};

type Comment = {
  user: string;
  text: string;
  createdAt?: Timestamp; // use "any" if you want to be loose
  upvotes?: number;
};
const TABS = ["All", "My Uni", "Tech", "Finance", "Trending"];

export default function ResumeHub() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedResume, setSelectedResume] = useState<Resume | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComments, setNewComments] = useState<{ [key: string]: string }>({});
  const [tab, setTab] = useState(TABS[0]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // ----------- Load resumes from Firestore -----------
  useEffect(() => {
    async function fetchResumes() {
      setLoading(true);
      const resumesCol = collection(db, "resumes");
      const q = query(resumesCol, orderBy("uploadedAt", "desc"));
      const snapshot = await getDocs(q);
      const resumesList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        ...(doc.data() as Omit<Resume, "id">),
      }));
      setResumes(resumesList);
      setLoading(false);
    }
    fetchResumes();
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return () => unsub();
  }, []);

  // Load comments when a resume is selected
  useEffect(() => {
    async function fetchComments() {
      if (!selectedResume) return;
      setCommentsLoading(true);
      const commentsRef = collection(
        db,
        "resumes",
        selectedResume.id,
        "comments"
      );
      const q = query(commentsRef, orderBy("createdAt", "asc"));
      const snap = await getDocs(q);
      const allComments: Comment[] = snap.docs.map(
        (doc) => doc.data() as Comment
      );
      setComments(allComments);
      setCommentsLoading(false);
    }
    fetchComments();
  }, [selectedResume]);

  // Auth
  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      if (err instanceof Error) {
        alert("Sign in failed: " + err.message);
      } else {
        alert("Sign in failed: " + String(err));
      }
    }
  };
  const handleSignOut = async () => {
    await signOut(auth);
  };

  // ---------- Upload & Save Resume Info to Firestore ----------
  const handleUploadClick = () => {
    if (user) fileInputRef.current?.click();
    else alert("Please sign in to upload resumes.");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && user) {
      const file = e.target.files[0];
      setResumes((prev) => [
        ...prev,
        {
          id: `uploading-${Date.now()}`,
          name: file.name,
          uploadedBy: user.displayName || "You",
          uploadedAt: new Date().toLocaleString(),
          status: "Uploading...",
          url: "", // <-- ADD THIS LINE
        },
      ]);
      try {
        const id = `resume-${Date.now()}`;
        const storageRef = ref(storage, `resumes/${id}_${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);

        // --- Save metadata to Firestore ---
        await addDoc(collection(db, "resumes"), {
          name: file.name,
          uploadedBy: user.displayName || "You",
          uploadedAt: serverTimestamp(),
          url,
        });

        // Reload resumes from Firestore
        const resumesCol = collection(db, "resumes");
        const q = query(resumesCol, orderBy("uploadedAt", "desc"));
        const snapshot = await getDocs(q);
        const resumesList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          ...(doc.data() as Omit<Resume, "id">),
        }));
        setResumes(resumesList);
      } catch (err) {
        if (err instanceof Error) {
          alert("Upload failed: " + err.message);
        } else {
          alert("Upload failed: " + String(err));
        }
      }

      e.target.value = "";
    }
  };

  // Comments - Save to Firestore and reload
  const handleAddComment = async (resumeId: string) => {
    if (!user) {
      alert("Sign in to comment!");
      return;
    }
    const text = newComments[resumeId]?.trim();
    if (!text) return;

    // Firestore add
    await addDoc(collection(db, "resumes", resumeId, "comments"), {
      user: user.displayName || "You",
      text,
      createdAt: serverTimestamp(),
      upvotes: 0,
    });

    // Refetch comments
    const commentsRef = collection(db, "resumes", resumeId, "comments");
    const q = query(commentsRef, orderBy("createdAt", "asc"));
    const snap = await getDocs(q);
    const allComments = snap.docs.map((doc) => doc.data() as Comment);
    setComments(allComments);

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
            {loading ? (
              <div className="text-gray-500 text-center py-16">
                Loading resumes...
              </div>
            ) : resumes.length === 0 ? (
              <div className="text-gray-500 text-center py-16">
                No resumes uploaded yet.
              </div>
            ) : (
              <div className="space-y-6">
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
                          <ellipse
                            cx="12"
                            cy="17"
                            rx="7"
                            ry="5"
                            fill="#E5E7EB"
                          />
                        </svg>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">
                          {r.uploadedBy}
                        </div>
                        <div className="text-gray-700">{r.name}</div>
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
            )}
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
          {commentsLoading ? (
            <div className="text-blue-500">Loading comments...</div>
          ) : comments.length === 0 ? (
            <div className="text-blue-500">No comments yet.</div>
          ) : (
            comments.map((c, i) => (
              <div
                key={i}
                className="bg-gray-50 rounded p-3 shadow-sm flex flex-col gap-1"
              >
                <div className="font-medium flex items-center gap-2">
                  <span>{c.user}</span>
                  <span className="text-xs text-gray-400">
                    {c.createdAt?.toDate
                      ? c.createdAt.toDate().toLocaleString()
                      : ""}
                  </span>
                </div>
                <div className="text-gray-700">{c.text}</div>
                <div className="text-xs text-gray-500">
                  {typeof c.upvotes === "number" &&
                    c.upvotes > 0 &&
                    `↑ ${c.upvotes} upvotes`}{" "}
                </div>
              </div>
            ))
          )}
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
