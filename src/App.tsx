/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Camera,
  Car,
  Check,
  ChevronRight,
  Fuel,
  Gauge,
  History,
  Image as ImageIcon,
  Loader2,
  Locate,
  MapPin,
  RefreshCcw,
  Send,
  Share2,
  Upload,
  X,
  Calendar,
  Phone,
  User,
  LayoutDashboard,
  LogOut,
  LogIn,
  Clock,
  Star,
  BadgeCheck as Verified,
  Lock,
  MessageCircle,
  Trophy,
  DollarSign,
  Search,
  ChevronLeft,
  Trash2,
  Activity,
  Play,
  Settings,
  Palette,
  Globe,
  Scan,
  Maximize2,
  RefreshCw,
} from "lucide-react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
} from "motion/react";
import React, { useState, useRef, useEffect, ChangeEvent } from "react";
import LocalScanner from "./components/LocalScanner";
import { auth, db, signIn, signOut } from "./lib/firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import {
  collection,
  addDoc,
  setDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import confetti from "canvas-confetti";

// Animated counter component
const AnimatedCounter = ({
  from,
  to,
  duration = 2.5,
  format = (v) => v,
  suffix = "",
}: {
  from: number;
  to: number;
  duration?: number;
  format?: (v: number) => string | number;
  suffix?: string;
}) => {
  const count = useMotionValue(from);
  const rounded = useTransform(count, (latest) => format(latest));

  useEffect(() => {
    const controls = animate(count, to, { duration, ease: "easeOut" });
    return controls.stop;
  }, [count, to, duration]);

  return (
    <>
      <motion.span>{rounded}</motion.span>
      {suffix}
    </>
  );
};

// Types for the extracted data
interface CarListingData {
  id?: string;
  makeModel: string;
  trimEdition: string;
  year: number | string;
  mileage: string;
  transmission: string;
  fuelType: string;
  price: string;
  originalPrice?: string;
  location: string;
  dealerName: string;
  extraInfo?: string;
}

interface LeadData {
  id?: string;
  name: string;
  phone: string;
  budget: string;
  status: "New" | "In Progress" | "Sold" | "Lost";
  createdAt: any;
  userId: string;
  wishlist?: CarListingData[];
  saleDetails?: {
    salePrice: number;
    commissionType: "Flat Fee" | "Percentage";
    commissionAmount: number;
    soldAt: any;
  };
}

interface BookingData {
  id?: string;
  customerName: string;
  phone: string;
  vehicle: string;
  date: string;
  time: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  createdAt: any;
  userId: string;
}

interface BrandingConfig {
  displayName: string;
  role: string;
  tagline: string;
  description: string;
  logoUrl: string;
  heroImageUrl: string;
  whatsappNumber: string;
  dealershipName: string;
  dealershipAddress?: string;
  dealershipMapEmbedUrl?: string;
  testimonialQuote?: string;
  testimonialAuthor?: string;
  showroomUrl: string;
  primaryColor: string;
  accentColor: string;
  goldColor: string;
  guideImageUrl: string;
  videoIntroUrl: string;
  cardOrientation: "vertical" | "horizontal";
}

// VW Colors
const VW_BLUE = "#001E50";
const VW_ACCENT = "#0042A5";
const VW_GOLD = "#D4AF37";
const VW_BG = "#F2F5F8";
const VW_LIGHT_BLUE = "#00B1EB";
const VW_BORDER = "rgba(0, 30, 80, 0.1)";

type AppState = "landing" | "unlock" | "scanner" | "success";

export default function App() {
  const ADMIN_EMAIL = "info.appledream@gmail.com";

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [appState, setAppState] = useState<AppState>("landing");
  const [activeTab, setActiveTab] = useState<"client" | "tracker">("client");
  const [adminTab, setAdminTab] = useState<"leads" | "settings">("leads");
  const [showGuide, setShowGuide] = useState(false);
  const [showVideoHero, setShowVideoHero] = useState(false);
  const [referrer, setReferrer] = useState<string>("Bruce Sprague");
  const [referrerParam, setReferrerParam] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("ref");
    }
    return null;
  });
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(false);
  const [isLiteMode, setIsLiteMode] = useState(false);

  const [branding, setBranding] = useState<BrandingConfig>({
    displayName: "Bruce Sprague",
    role: "Mastercars Specialist",
    tagline: '"Trust Bruce. Drive Better."',
    description:
      "19 years of dedicated VW expertise. I don't just sell cars; I build relationships that last as long as a MasterCar.",
    logoUrl: "/bruce-avatar.png",
    heroImageUrl: "/bruce-hero.jpg",
    whatsappNumber: "27827752992",
    dealershipName: "West Cape VW",
    dealershipAddress: "Cape Town, South Africa",
    dealershipMapEmbedUrl:
      "https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d1105!2d18.694805!3d-33.835735!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x1dcc51deef684f2f%3A0xac5f54337134e8f4!2sWest%20Cape%20Volkswagen!5e0!3m2!1sen!2sza",
    testimonialQuote:
      "I make buying your car the easiest experience you will ever have. Professional, honest, and dedicated to your needs.",
    testimonialAuthor: "Happy Customer",
    showroomUrl: "https://www.cfaomobility.co.za/volkswagen/offers/west-cape/used/",
    primaryColor: "#001E50", 
    accentColor: "#0042A5", 
    goldColor: "#D4AF37",
    guideImageUrl: "/sample-card.jpg",
    dealershipLocation: "Cape Town, South Africa",
    videoIntroUrl: "/bruce-intro.mp4",
    cardOrientation: "vertical",
  });

  const isSuperAdmin = user?.email === ADMIN_EMAIL && user?.emailVerified;
  // Any verified salesperson can have their own hub
  const isAdmin = user !== null && user?.emailVerified;

  // Sync current salesperson's name for filtering
  const [salespersonName, setSalespersonName] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin && user) {
      setSalespersonName(user.displayName || referrer);
    } else {
      setSalespersonName(null);
    }
  }, [isAdmin, user, referrer]);

  // Lead / Unlock State
  const [leadForm, setLeadForm] = useState(() => {
    try {
      const stored = localStorage.getItem("leadForm");
      if (stored && stored !== "undefined") {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Failed to parse leadForm", e);
    }
    return { name: "", phone: "", budget: "" };
  });
  const [currentLeadId, setCurrentLeadId] = useState<string | null>(() => {
    try {
      return localStorage.getItem("currentLeadId");
    } catch (e) {
      return null;
    }
  });
  const [isCapturingLead, setIsCapturingLead] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem("leadForm", JSON.stringify(leadForm));
    } catch (e) {
      console.warn("localStorage blocked");
    }
  }, [leadForm]);

  // Scanner State
  const [error, setError] = useState<string | null>(null);

  // Admin / Tracker States
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [wishlist, setWishlist] = useState<CarListingData[]>([]);
  const [selectedLeadForSale, setSelectedLeadForSale] =
    useState<LeadData | null>(null);
  const [saleForm, setSaleForm] = useState({
    price: "",
    commissionType: "Fixed",
    commissionValue: "",
  });

  const updateLeadStatus = async (id: string, status: LeadData["status"]) => {
    try {
      if (status === "Sold") {
        const lead = leads.find((l) => l.id === id);
        if (lead) setSelectedLeadForSale(lead);
      } else {
        await updateDoc(doc(db, "leads", id), { status });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const successRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    setIsAuthChecking(true);
    let unsubscribe: any = undefined;
    try {
      unsubscribe = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setIsAuthChecking(false);
      }, (error) => {
        console.error("Auth check failed:", error);
        setIsAuthChecking(false);
      });
    } catch (e) {
      console.warn("Auth initialization error", e);
      setIsAuthChecking(false);
    }
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;
    let unsubBranding: (() => void) | undefined;
    let unsubGlobal: (() => void) | undefined;

    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    
    // Default to false so it unblocks rendering when there is no slug
    setIsLoadingProfile(false);

    if (activeTab === "tracker" && user && !isAdmin && isSuperAdmin) {
      // SuperAdmin manages global settings, handled by a different path or logic
    }

    // If salesperson is in tracker, fetch their own profile
    if (activeTab === "tracker" && user && !isSuperAdmin) {
      setIsLoadingProfile(true);
      const profileRef = doc(db, "profiles", user.uid);
      unsubProfile = onSnapshot(profileRef, (d) => {
        if (d.exists()) setBranding((prev) => ({ ...prev, ...d.data() }));
        setIsLoadingProfile(false);
      });
    }

    // Only fetch specific target branding if a referral exists
    if (ref) {
      setIsLoadingProfile(true);
      const brandingRef = doc(db, "profiles", ref);
      unsubBranding = onSnapshot(brandingRef, (d) => {
        if (d.exists()) {
          const data = d.data();
          setBranding((prev) => ({ ...prev, ...data }));
          setIsLoadingProfile(false);
        } else if (ref === "bruce") {
          // Hardcoded Demo Fallback for Bruce
          setBranding((prev) => ({
            ...prev,
            displayName: "Bruce Sprague",
            role: "Mastercars Specialist",
            tagline: '"Trust Bruce. Drive Better."',
            description:
              "19 years of dedicated VW expertise. I don't just sell cars; I build relationships that last as long as a MasterCar.",
            logoUrl: "/bruce-avatar.png",
            heroImageUrl: "/bruce-hero.jpg",
            whatsappNumber: "27827752992",
            dealershipName: "West Cape VW",
            showroomUrl:
              "https://www.cfaomobility.co.za/volkswagen/offers/west-cape/used/",
            primaryColor: "#001E50",
            accentColor: "#0042A5",
            goldColor: "#D4AF37",
            guideImageUrl: "/sample-card.jpg",
            videoIntroUrl: "/bruce-intro.mp4",
            cardOrientation: "vertical",
          }));
          setIsLoadingProfile(false);
        } else {
          // Fallback: If ref was set but doc didn't exist in profiles, try global settings
          unsubGlobal = onSnapshot(
            doc(db, "settings", "branding"),
            (gd) => {
              if (gd.exists()) {
                setBranding((prev) => ({ ...prev, ...gd.data() }));
              }
              setIsLoadingProfile(false);
            },
          );
        }
      });
    }

    // URL Param Detection
    const mode = params.get("mode");
    if (ref) {
      setReferrer(ref);
    }

    if (mode === "scanner") {
      setIsLiteMode(true);
      // Auto-transition to scan view if we have a current lead, else to capture form
      if (currentLeadId) {
        setAppState("scanner");
      } else if (appState === "landing") {
        setAppState("unlock");
      }
    }

    return () => {
      if (unsubProfile) unsubProfile();
      if (unsubBranding) unsubBranding();
      if (unsubGlobal) unsubGlobal();
    };
  }, [referrerParam, currentLeadId, isAdmin, isSuperAdmin, salespersonName, activeTab, user, appState]);

  useEffect(() => {
    let unsubLeads: (() => void) | undefined;
    let unsubLead: (() => void) | undefined;

    // Admin View: Sync leads (Filtered for salespeople, full for super admin)
    if (isAdmin) {
      let leadsQuery;
      if (isSuperAdmin) {
        leadsQuery = query(
          collection(db, "leads"),
          orderBy("createdAt", "desc"),
        );
      } else {
        // Salesperson only sees their own leads based on referrer name
        leadsQuery = query(
          collection(db, "leads"),
          where("referrer", "==", salespersonName || referrer),
          orderBy("createdAt", "desc"),
        );
      }

      unsubLeads = onSnapshot(
        leadsQuery,
        (s) => {
          setLeads(
            s.docs.map((d) => ({ id: d.id, ...d.data() })) as LeadData[],
          );
        },
        (err) => {
          console.warn("Leads snapshot error:", err);
        },
      );
    }

    // Client View: Sync ONLY current lead
    if (currentLeadId) {
      unsubLead = onSnapshot(
        doc(db, "leads", currentLeadId),
        (d) => {
          if (d.exists()) {
            const data = d.data() as LeadData;
            if (data.wishlist) setWishlist(data.wishlist);
          }
        },
        (err) => {
          console.warn("Lead doc snapshot error:", err);
        },
      );
    }
    
    return () => {
      if (unsubLeads) unsubLeads();
      if (unsubLead) unsubLead();
    };
  }, [isAdmin, isSuperAdmin, salespersonName, currentLeadId, referrer]);

  const captureLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCapturingLead(true);
    try {
      const docRef = await addDoc(collection(db, "leads"), {
        ...leadForm,
        referrer,
        status: "New",
        createdAt: serverTimestamp(),
        wishlist: [],
      });
      setCurrentLeadId(docRef.id);
      try {
        localStorage.setItem("currentLeadId", docRef.id);
      } catch (e) {
        console.warn("localStorage blocked");
      }
      setAppState("scanner");
    } catch (err) {
      setError("Failed to capture lead details.");
    } finally {
      setIsCapturingLead(false);
    }
  };

  const saveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !user) return;
    try {
      if (isSuperAdmin) {
        await updateDoc(doc(db, "settings", "branding"), branding as any);
      } else {
        // Salespeople save to their profile document using their UID
        await setDoc(
          doc(db, "profiles", user.uid),
          {
            ...branding,
            userId: user.uid,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }
      alert("Personal branding updated successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to update branding. Check permissions.");
    }
  };

  const addToWishlist = async (car: CarListingData) => {
    if (!currentLeadId) {
      alert("Please restart the session (Capture lead first).");
      return;
    }

    try {
      const leadRef = doc(db, "leads", currentLeadId);
      const carWithId = { ...car, id: Date.now().toString() };

      await updateDoc(leadRef, {
        wishlist: arrayUnion(carWithId),
      });

      confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
    } catch (err) {
      console.error("Failed to save to wishlist:", err);
      alert("Could not add to wishlist. Please check connection.");
    }
  };

  const sendFullWishlistToBruce = () => {
    if (wishlist.length === 0) return;

    const lead = leads.find((l) => l.id === currentLeadId) || leadForm;

    let text =
      `*🚨 New Vehicle Wishlist from ${lead.name}* \n\n` +
      `*Client Details:* \n` +
      `👤 Name: *${lead.name}*\n` +
      `📱 WhatsApp: ${lead.phone}\n` +
      `💰 Budget: ${lead.budget}\n` +
      `🔗 Referral: ${referrer}\n\n` +
      `*Selections (${wishlist.length}):* \n\n`;

    wishlist.forEach((car, i) => {
      text +=
        `${i + 1}. *${car.makeModel}*\n` +
        `   🏷️ Trim: ${car.trimEdition || "Standard"}\n` +
        `   🗓️ Year: ${car.year}\n` +
        `   🛣️ Mileage: ${car.mileage || "N/A"}\n` +
        `   ⚙️ Transmission: ${car.transmission || "N/A"}\n` +
        `   💰 Price: *${car.price}*\n` +
        `   📍 Location: ${car.location || branding.dealershipName}\n\n`;
    });

    text += `${branding.displayName}, I scanned these from the showroom floor. Please check availability!`;

    window.open(
      `https://wa.me/${branding.whatsappNumber}?text=${encodeURIComponent(text)}`,
      "_blank",
    );

    setAppState("success");
    successRef.current?.play();
  };

  const removeFromWishlist = async (car: CarListingData) => {
    if (!currentLeadId) return;
    try {
      await updateDoc(doc(db, "leads", currentLeadId), {
        wishlist: arrayRemove(car),
      });
    } catch (err) {
      console.error("Failed to remove from wishlist:", err);
    }
  };

  const handleSaleConfirm = async () => {
    if (!selectedLeadForSale || !user) return;
    try {
      await updateDoc(doc(db, "leads", selectedLeadForSale.id!), {
        status: "Sold",
        saleDetails: {
          salePrice: saleForm.price,
          commissionType: saleForm.commissionType,
          commissionAmount: saleForm.commissionValue,
          soldAt: new Date().toISOString(),
        },
      });

      const text =
        `*🏆 CONGRATS ${branding.displayName.toUpperCase()}! SALE NOTIFICATION* \n\n` +
        `🏠 *Dealship:* ${branding.dealershipName}\n` +
        `👤 *Customer:* ${selectedLeadForSale.name}\n` +
        `💸 *Sale Price:* R${saleForm.price}\n` +
        `💵 *Spotter Fee:* R${saleForm.commissionValue} (${saleForm.commissionType})\n\n` +
        `_Inventory ledger has been updated accurately._`;
      window.open(
        `https://wa.me/${branding.whatsappNumber}?text=${encodeURIComponent(text)}`,
        "_blank",
      );
      setSelectedLeadForSale(null);
      setSaleForm({ price: "", commissionType: "Fixed", commissionValue: "" });
    } catch (err) {
      console.error(err);
    }
  };

  const startNewSearch = () => {
    setAppState("landing");
    setCurrentLeadId(null);
    try {
      localStorage.removeItem("currentLeadId");
    } catch (e) {
      // Ignore
    }
  };

  if (isLoadingProfile || isAuthChecking) {
    return (
      <div className="min-h-screen bg-vw-bg flex items-center justify-center">
        <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 9999, fontSize: '10px' }}>
          DEBUG: isLoadingProfile={isLoadingProfile.toString()}, isAuthChecking={isAuthChecking.toString()}
        </div>
        <motion.div
           initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-6"
        >
          <div className="relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            >
              <RefreshCw className="text-vw-blue" size={48} />
            </motion.div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Scan size={16} className="text-vw-blue opacity-40" />
            </div>
          </div>
          <div className="text-[10px] font-black text-vw-blue uppercase tracking-[5px] italic animate-pulse">
            Syncing Intelligence...
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-vw-bg text-vw-text font-sans"
      style={{
        // Inject dynamic branding variables for Tailwind to pick up
        ["--vw-blue" as any]: branding.primaryColor,
        ["--vw-accent" as any]: branding.accentColor,
        ["--vw-gold" as any]: branding.goldColor,
      }}
    >
      <audio
        ref={successRef}
        src="https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3"
      />

      {/* Salesperson/Customer Flow */}
      <>
        {/* Video Hero Modal */}
        <AnimatePresence>
            {showVideoHero && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-vw-blue/90 backdrop-blur-xl">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="relative h-[80vh] max-h-[800px] aspect-[9/16] bg-black rounded-3xl md:rounded-[40px] overflow-hidden shadow-2xl border border-white/10 mx-auto"
                >
                  <button
                    onClick={() => setShowVideoHero(false)}
                    className="absolute top-4 right-4 z-20 w-10 h-10 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all"
                  >
                    <X size={20} />
                  </button>
                  <div className="absolute inset-0 flex items-center justify-center text-white/20 text-xs font-black uppercase tracking-widest italic text-center px-4">
                    [ {branding.displayName.toUpperCase()} INTRODUCTION ]
                  </div>
                  <video
                    className="w-full h-full relative z-10 object-cover"
                    src={branding.videoIntroUrl}
                    controls
                    controlsList="nofullscreen nodownload"
                    disablePictureInPicture
                    autoPlay
                    playsInline
                  >
                    Your browser does not support the video tag.
                  </video>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Editorial Header */}
          {!isLiteMode && (
            <header className="h-[60px] md:h-[90px] bg-white border-b border-vw-border px-3 md:px-12 flex items-center justify-between sticky top-0 z-50">
              <div className="flex items-center gap-4 md:gap-10">
                <div
                  className="flex items-center gap-2 md:gap-4 group cursor-pointer"
                  onClick={() => setActiveTab("client")}
                >
                  <img
                    src={branding.logoUrl}
                    className="w-7 h-7 md:w-12 md:h-12 rounded-full border-2 border-vw-blue object-cover shrink-0"
                    alt={branding.displayName}
                  />
                  <div className="leading-tight">
                    <div className="text-sm sm:text-lg font-black text-vw-blue uppercase italic tracking-tighter group-hover:text-vw-accent transition-colors">
                      {branding.displayName || "WhatsLocal"} Deals
                    </div>
                    <div className="text-[8px] sm:text-[10px] font-bold text-vw-muted uppercase tracking-widest leading-none">
                      {branding.role || "Sales Intelligence"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => setActiveTab("tracker")}
                  className="text-vw-blue/40 hover:text-vw-blue transition-colors"
                >
                  <Activity size={20} />
                </button>
              </div>
            </header>
          )}

          <main className="max-w-6xl mx-auto p-2 md:p-12 min-h-[calc(100vh-130px)]">
            <AnimatePresence mode="wait">
              {activeTab === "client" ? (
                <motion.div
                  key="client-flow"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {appState === "landing" && (
                    <div className="space-y-8 md:space-y-12">
                      {/* Personal Brand Section */}
                      <div className="bg-vw-blue text-white rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden relative min-h-auto md:min-h-[650px] flex items-center">
                        {/* Background Image with Overlays */}
                        <div className="absolute inset-0 z-0">
                          <img
                            src={branding.heroImageUrl}
                            referrerPolicy="no-referrer"
                            alt={branding.dealershipName}
                            className="w-full h-full object-cover object-[center_30%]"
                          />
                          <div className="absolute inset-0 bg-vw-blue/40 mix-blend-multiply" />
                          <div className="absolute inset-0 bg-gradient-to-r from-vw-blue via-vw-blue/60 to-transparent md:to-vw-blue/20" />
                          <div className="absolute inset-0 bg-gradient-to-t from-vw-blue via-transparent to-transparent opacity-50" />
                        </div>

                        {/* Content Container */}
                        <div className="p-8 md:p-12 space-y-8 md:space-y-10 relative z-20 flex flex-col justify-center w-full md:max-w-2xl">
                          <div className="flex items-center gap-3 md:gap-4">
                            <Verified
                              className="text-vw-LIGHT_BLUE shrink-0"
                              size={20}
                            />
                            <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-vw-LIGHT_BLUE leading-tight">
                              Verified Executive Consultant
                            </span>
                          </div>
                          <div className="space-y-3 md:space-y-4">
                            <h1 className="text-5xl sm:text-6xl md:text-7xl font-black italic tracking-tighter leading-[0.8]">
                              {branding.displayName.split(" ")[0]} <br />
                              Specialist.
                            </h1>
                            <h2 className="text-xl md:text-2xl font-light text-vw-LIGHT_BLUE italic tracking-tight">
                              {branding.tagline}
                            </h2>
                          </div>
                          <p className="text-base md:text-lg font-light text-vw-LIGHT_BLUE leading-relaxed">
                            {branding.description}
                          </p>

                          <div className="grid grid-cols-2 gap-6 md:gap-10 pt-8 md:pt-10 border-t border-white/20">
                            <div>
                              <div className="text-4xl md:text-5xl font-black italic mb-2 tracking-tighter">
                                <AnimatedCounter
                                  from={0}
                                  to={19}
                                  format={Math.round}
                                  suffix="+"
                                />
                              </div>
                              <div className="text-[9px] md:text-[10px] uppercase font-black tracking-[3px] opacity-60 leading-tight">
                                Years Floor Service
                              </div>
                            </div>
                            <div>
                              <div className="text-4xl md:text-5xl font-black italic mb-2 tracking-tighter">
                                <AnimatedCounter
                                  from={0}
                                  to={5}
                                  format={(v) => v.toFixed(1)}
                                />
                              </div>
                              <div className="text-[9px] md:text-[10px] uppercase font-black tracking-[3px] opacity-60 leading-tight">
                                Google Rating
                              </div>
                            </div>
                          </div>

                          {/* Floating Badge moved inline */}
                          <div className="bg-white/10 backdrop-blur-2xl p-4 md:p-6 rounded-2xl border border-white/10 shadow-3xl text-center md:text-left inline-block w-full sm:w-auto mt-4">
                            <div className="flex gap-1 justify-center md:justify-start mb-2 md:mb-3">
                              {[1, 2, 3, 4, 5].map((i) => (
                                <Star
                                  key={i}
                                  size={12}
                                  className="text-vw-GOLD fill-current"
                                />
                              ))}
                            </div>
                            <p className="text-[10px] md:text-xs font-black uppercase tracking-[4px] italic">
                              "{branding.displayName} sets the standard."
                            </p>
                          </div>

                          <div className="flex flex-col gap-4 sm:gap-6 pt-6 flex-wrap">
                            <button
                              onClick={() => setAppState("unlock")}
                              className="w-full bg-vw-GOLD hover:scale-105 active:scale-95 text-vw-blue font-black py-4 sm:py-6 px-4 sm:px-12 rounded-2xl flex items-center justify-center gap-2 sm:gap-4 transition-all shadow-2xl group text-xs sm:text-sm italic tracking-tighter"
                            >
                              VISIT SHOWROOM{" "}
                              <ChevronRight className="group-hover:translate-x-2 transition-transform" />
                            </button>
                            <div className="flex gap-2 sm:gap-4 w-full">
                              <button
                                onClick={() => setShowVideoHero(true)}
                                className="flex-1 min-w-0 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 text-white font-black py-4 sm:py-6 px-2 sm:px-8 rounded-2xl flex items-center justify-center gap-1.5 sm:gap-3 transition-all group text-[10px] sm:text-base"
                              >
                                <div className="relative shrink-0">
                                  <Play
                                    size={16}
                                    className="sm:w-[18px] sm:h-[18px]"
                                    fill="currentColor"
                                  />
                                  <div className="absolute inset-0 animate-ping bg-vw-GOLD/40 rounded-full" />
                                </div>
                                <span>INTRO</span>
                              </button>
                              <a
                                href="https://cfaob.id/bruce.sprague"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 min-w-0 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 text-white font-black py-4 sm:py-6 px-2 sm:px-8 rounded-2xl flex items-center justify-center gap-1.5 sm:gap-3 transition-all group text-[10px] sm:text-base"
                              >
                                <Phone
                                  size={16}
                                  className="sm:w-[18px] sm:h-[18px] text-vw-LIGHT_BLUE shrink-0"
                                />
                                <span>VCARD</span>
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Persona Sections */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                          {
                            title: "For Families",
                            image: "/family-delivery.jpg",
                            desc: "Safety-first MasterCars with full warranties for the school run.",
                          },
                          {
                            title: "Young Professionals",
                            image: "/pro-delivery.jpg",
                            desc: "Ambition meets budget. 24h finance pre-approval, no hidden costs.",
                          },
                          {
                            title: "Easy Trade-Ins",
                            image: "/trade-delivery.jpg",
                            desc: "Get market-leading value for your current vehicle instantly.",
                          },
                        ].map((item, i) => (
                          <motion.div
                            key={i}
                            whileHover={{ y: -10 }}
                            className="bg-white rounded-[32px] overflow-hidden border border-vw-border shadow-sm group flex flex-col"
                          >
                            <div className="w-full aspect-[4/3] bg-vw-bg relative overflow-hidden">
                              <img
                                src={item.image}
                                alt={item.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            </div>
                            <div className="p-8 flex-1 flex flex-col">
                              <h3 className="text-xl font-black text-vw-blue uppercase italic mb-4">
                                {item.title}
                              </h3>
                              <p className="text-vw-muted text-sm leading-relaxed mb-6 flex-1">
                                {item.desc}
                              </p>
                              <button
                                onClick={() => setAppState("unlock")}
                                className="text-vw-blue font-black text-[10px] uppercase tracking-widest flex items-center gap-2 group-hover:gap-4 transition-all"
                              >
                                Explore Options <ChevronRight size={14} />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      {/* Featured Testimonial */}
                      <div className="pt-8">
                        <div className="bg-vw-blue text-white rounded-[40px] p-10 md:p-14 relative overflow-hidden shadow-2xl border border-vw-blue/20">
                          <div className="absolute top-0 right-0 p-12 opacity-5">
                            <svg
                              width="200"
                              height="200"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path d="M14.017 21L16.417 14.591L16.413 14.584C16.895 13.313 17.157 11.954 17.157 10.5C17.157 6.35775 13.8005 3 9.6585 3C5.5165 3 2.16 6.35775 2.16 10.5C2.16 14.6423 5.5165 18 9.6585 18C10.741 18 11.769 17.766 12.695 17.346L14.017 21ZM21.84 21L24.24 14.591L24.236 14.584C24.718 13.313 24.98 11.954 24.98 10.5C24.98 6.35775 21.6235 3 17.4815 3C13.3395 3 9.983 6.35775 9.983 10.5C9.983 14.6423 13.3395 18 17.4815 18C18.564 18 19.592 17.766 20.518 17.346L21.84 21Z" />
                            </svg>
                          </div>
                          <div className="relative z-10 flex flex-col md:flex-row gap-10 items-center md:items-start text-center md:text-left">
                            <div className="flex-1 space-y-8">
                              <div className="flex gap-1.5 justify-center md:justify-start">
                                {[1, 2, 3, 4, 5].map((i) => (
                                  <Star
                                    key={i}
                                    size={24}
                                    className="text-vw-GOLD fill-current"
                                  />
                                ))}
                              </div>
                              <blockquote className="text-2xl md:text-3xl font-light italic leading-tight text-white max-w-4xl mx-auto">
                                "Bruce made buying my car the easiest experience
                                I have ever had. He was professional, honest,
                                and found exactly what I needed within my
                                budget. I would recommend him to anyone without
                                hesitation."
                              </blockquote>
                              <div className="pt-4 border-t border-white/10 flex items-center justify-center md:justify-start gap-4">
                                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-xl font-black">
                                  J
                                </div>
                                <div>
                                  <div className="font-black tracking-widest uppercase text-sm">
                                    Johann van Genderen
                                  </div>
                                  <div className="text-vw-LIGHT_BLUE text-[10px] font-bold uppercase tracking-widest mt-1 flex items-center gap-1 justify-center md:justify-start">
                                    <img
                                      src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg"
                                      alt="Google"
                                      className="w-3 h-3 grayscale contrast-200"
                                    />
                                    Verified Google Review
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Floor Map & Dealership */}
                      <div className="pt-8 block">
                        <div className="bg-white rounded-[40px] overflow-hidden shadow-2xl border border-vw-border">
                          <div className="p-8 md:p-12 border-b border-vw-border flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="text-center md:text-left flex-1">
                              <h3 className="text-2xl font-black text-vw-blue italic uppercase tracking-tighter mb-2">
                                West Cape VW
                              </h3>
                              <p className="text-vw-muted font-bold flex items-center gap-2 justify-center md:justify-start">
                                <MapPin
                                  size={18}
                                  className="text-vw-accent shrink-0"
                                />{" "}
                                <span className="text-sm">
                                  Cnr Brighton & Okavango roads, Kraaifontein
                                  7570
                                </span>
                              </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
                              <a
                                href="https://maps.app.goo.gl/64yKb4pY2SypANf99"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-vw-blue text-white hover:bg-vw-accent px-6 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] md:text-xs transition-colors whitespace-nowrap text-center flex items-center justify-center gap-2"
                              >
                                <MapPin size={14} /> Get Directions
                              </a>
                              <a
                                href={branding.showroomUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-white text-vw-blue border-2 border-vw-blue hover:bg-vw-bg px-6 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] md:text-xs transition-colors whitespace-nowrap text-center flex items-center justify-center gap-2"
                              >
                                <Globe size={14} /> View Website
                              </a>
                            </div>
                          </div>
                          <div className="w-full aspect-video md:aspect-[21/9] bg-vw-bg relative">
                            <iframe
                              src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d3314.092131161933!2d18.6948054!3d-33.8357346!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x1dcc51deef684f2f%3A0xac5f54337134e8f4!2sWest%20Cape%20Volkswagen!5e0!3m2!1sen!2sza!4v1776678879708!5m2!1sen!2sza"
                              className="w-full h-full absolute inset-0 grayscale contrast-125 hover:grayscale-0 transition-all duration-700"
                              style={{ border: 0 }}
                              allowFullScreen={true}
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                              title="West Cape VW Location"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {appState === "unlock" && (
                    <div className="max-w-xl mx-auto space-y-10">
                      <div className="flex items-center">
                        <button
                          onClick={() => setAppState("landing")}
                          className="flex items-center gap-2 text-xs font-black uppercase tracking-[2px] text-vw-muted hover:text-vw-blue transition-colors group"
                        >
                          <ChevronLeft
                            size={16}
                            className="group-hover:-translate-x-1 transition-transform"
                          />{" "}
                          BACK TO PROFILE
                        </button>
                      </div>
                      <div className="text-center space-y-4">
                        <div className="w-16 h-16 bg-vw-blue rounded-full mx-auto flex items-center justify-center text-white mb-6 shadow-xl">
                          <Lock size={24} />
                        </div>
                        <h2 className="text-4xl font-black text-vw-blue uppercase italic tracking-tighter">
                          Enter Showroom
                        </h2>
                        <p className="text-vw-muted text-sm font-bold uppercase tracking-widest">
                          Connect with Bruce to access CFAO Mobility Inventory
                        </p>
                      </div>
                      <form
                        onSubmit={captureLead}
                        className="bg-white p-12 rounded-[40px] shadow-2xl border border-vw-border space-y-8"
                      >
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-vw-muted uppercase tracking-widest">
                            Full Name
                          </label>
                          <input
                            required
                            value={leadForm.name}
                            onChange={(e) =>
                              setLeadForm({ ...leadForm, name: e.target.value })
                            }
                            type="text"
                            className="w-full bg-vw-bg border-none rounded-2xl p-5 text-sm font-bold focus:ring-2 focus:ring-vw-accent"
                            placeholder="e.g. Sarah Johnson"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-vw-muted uppercase tracking-widest">
                              WhatsApp Number
                            </label>
                            <input
                              required
                              value={leadForm.phone}
                              onChange={(e) =>
                                setLeadForm({
                                  ...leadForm,
                                  phone: e.target.value,
                                })
                              }
                              type="tel"
                              className="w-full bg-vw-bg border-none rounded-2xl p-5 text-sm font-bold focus:ring-2 focus:ring-vw-accent"
                              placeholder="082 123 4567"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-vw-muted uppercase tracking-widest">
                              Monthly Budget
                            </label>
                            <input
                              required
                              value={leadForm.budget}
                              onChange={(e) =>
                                setLeadForm({
                                  ...leadForm,
                                  budget: e.target.value,
                                })
                              }
                              type="text"
                              className="w-full bg-vw-bg border-none rounded-2xl p-5 text-sm font-bold focus:ring-2 focus:ring-vw-accent"
                              placeholder="R5,500 - R7,500/pm"
                            />
                          </div>
                        </div>
                        <button
                          disabled={isCapturingLead}
                          className="w-full bg-vw-blue hover:bg-vw-accent text-white font-black py-6 rounded-2xl flex items-center justify-center gap-4 transition-all shadow-xl uppercase tracking-widest italic tracking-tighter disabled:opacity-50"
                        >
                          {isCapturingLead ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <Lock size={20} />
                          )}{" "}
                          ACCESS LIVE INVENTORY →
                        </button>
                      </form>
                    </div>
                  )}

                  {appState === "scanner" && (
                    <div className="space-y-6 md:space-y-12">
                      <div className="flex items-center">
                        <button
                          onClick={() => setAppState("unlock")}
                          className="flex items-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-[1px] md:tracking-[2px] text-vw-muted hover:text-vw-blue transition-colors group"
                        >
                          <ChevronLeft
                            size={16}
                            className="group-hover:-translate-x-1 transition-transform"
                          />{" "}
                          BACK TO DETAILS
                        </button>
                      </div>
                      <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8 bg-vw-blue text-white p-5 md:p-8 rounded-[32px] md:rounded-[40px] shadow-2xl relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-black/0 via-black/10 to-transparent pointer-events-none" />
                        <div className="space-y-3 relative z-10 w-full md:w-auto">
                          <div className="flex items-center justify-center md:justify-start gap-2 text-[9px] md:text-xs font-black uppercase tracking-widest text-vw-LIGHT_BLUE">
                            <Verified size={14} className="shrink-0" />{" "}
                            {referrer.toUpperCase()}'S EXCLUSIVE AI TECHNOLOGY
                          </div>
                          <h2 className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter shadow-sm text-center md:text-left leading-none">
                            {referrer}'s Elite Scanner
                          </h2>
                          <p className="text-[9px] md:text-xs font-medium text-vw-LIGHT_BLUE text-center md:text-left opacity-80 leading-relaxed">
                            Save up to 2 units from the floor.
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 relative z-10 w-full md:w-auto">
                          <a
                            href="https://www.cfaomobility.co.za/used-cars/west-cape-volkswagen/"
                            target="_blank"
                            rel="noreferrer"
                            className="bg-white text-vw-blue font-black px-5 py-3 md:px-6 md:py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-vw-GOLD hover:text-vw-blue transition-all shadow-xl whitespace-nowrap group text-[10px] md:text-xs uppercase tracking-widest flex-1 sm:flex-none"
                          >
                            BROWSE FLOOR{" "}
                            <ChevronRight
                              size={14}
                              className="group-hover:translate-x-1 transition-transform"
                            />
                          </a>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-[1fr_450px] gap-6 md:gap-12">
                        <div className="space-y-8">
                          <div className="bg-white p-4 sm:p-10 rounded-[32px] sm:rounded-[40px] border border-vw-border shadow-sm space-y-4 md:space-y-6">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm md:text-xl font-black text-vw-blue uppercase italic">
                                Step 2 — Scan Selection
                              </h3>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                <div className="text-[10px] font-black text-vw-muted uppercase tracking-widest leading-none">
                                  SYSTEM READY
                                </div>
                              </div>
                            </div>

                            {/* Visual Scanning Guide - Now a compact info bar */}
                            <div className="bg-vw-bg/50 backdrop-blur-sm p-2 md:p-4 rounded-xl md:rounded-2xl border border-vw-border flex items-center justify-between gap-4 overflow-hidden relative">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-vw-blue text-white flex items-center justify-center shadow-md shrink-0">
                                  <Scan size={14} />
                                </div>
                                <div>
                                  <h4 className="text-[9px] font-black uppercase text-vw-blue tracking-widest leading-none mb-1">
                                    {referrer}'s Elite Guide
                                  </h4>
                                  <p className="text-[8px] text-vw-muted italic">
                                    3 Stages to Perfect Data
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                                {[
                                  { l: "Steady", i: <RefreshCw size={10} /> },
                                  { l: "Focus", i: <Maximize2 size={10} /> },
                                  { l: "Review", i: <Star size={10} /> },
                                ].map((step, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-1 bg-white border border-vw-border/50 px-2 py-1 rounded-full shadow-sm shrink-0"
                                  >
                                    <span className="text-vw-blue/40">
                                      {step.i}
                                    </span>
                                    <span className="text-[8px] font-black uppercase text-vw-blue tracking-tighter">
                                      {step.l}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <button
                                onClick={() => setShowGuide(true)}
                                className="bg-white text-vw-blue border border-vw-blue font-black px-3 py-1.5 rounded-full uppercase italic hover:bg-vw-blue hover:text-white transition-all shadow-md shrink-0 flex items-center gap-1 text-[8px]"
                              >
                                <Camera size={10} /> Ref Guide
                              </button>
                            </div>

                            {/* Reference Image Modal/Overlay */}
                            {showGuide && (
                              <div
                                className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
                                onClick={() => setShowGuide(false)}
                              >
                                <motion.div
                                  initial={{ scale: 0.9, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  className="bg-white p-6 rounded-[32px] max-w-sm w-full shadow-2xl relative"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={() => setShowGuide(false)}
                                    className="absolute -top-3 -right-3 bg-vw-blue text-white w-8 h-8 rounded-full flex items-center justify-center shadow-xl"
                                  >
                                    <X size={16} />
                                  </button>
                                  <div className="text-left space-y-4">
                                    <div className="bg-vw-accent/10 py-1 px-3 rounded-full inline-block">
                                      <span className="text-[10px] font-black text-vw-accent uppercase italic">
                                        How to Scan Perfect Data
                                      </span>
                                    </div>
                                    <ol className="space-y-3 text-[11px] font-medium text-vw-blue">
                                      <li className="flex gap-3">
                                        <span className="font-black text-vw-accent">
                                          1.
                                        </span>{" "}
                                        Start by tapping the Ref Guide to see an
                                        ideal capture.
                                      </li>
                                      <li className="flex gap-3">
                                        <span className="font-black text-vw-accent">
                                          2.
                                        </span>{" "}
                                        Browse the floor or take a photo with
                                        your phone.
                                      </li>
                                      <li className="flex gap-3">
                                        <span className="font-black text-vw-accent">
                                          3.
                                        </span>{" "}
                                        Ensure card alignment and good light,
                                        then extract.
                                      </li>
                                    </ol>
                                    <img
                                      src={branding.guideImageUrl}
                                      alt="Optimal scan"
                                      className="w-full h-auto rounded-2xl shadow-inner border border-vw-border"
                                    />
                                    <button
                                      onClick={() => setShowGuide(false)}
                                      className="w-full bg-vw-blue text-white py-3 rounded-xl font-black uppercase text-[10px]"
                                    >
                                      Close Guide
                                    </button>
                                  </div>
                                </motion.div>
                              </div>
                            )}

                            <div className="relative">
                              <LocalScanner
                                orientation={branding.cardOrientation}
                                onScanComplete={(carData) =>
                                  addToWishlist(carData)
                                }
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-8">
                          <div className="bg-white p-8 rounded-[40px] border border-vw-border shadow-sm min-h-[500px] flex flex-col">
                            <div className="flex items-center justify-between mb-8 pb-4 border-b border-vw-border">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-vw-GOLD flex items-center justify-center text-vw-blue">
                                  <Star size={14} />
                                </div>
                                <h3 className="text-sm font-black text-vw-blue uppercase tracking-widest italic">
                                  Live Wishlist
                                </h3>
                              </div>
                              <div className="text-[10px] font-black text-vw-muted uppercase tracking-widest">
                                ({wishlist.length}{" "}
                                {wishlist.length === 1 ? "UNIT" : "UNITS"})
                              </div>
                            </div>

                            {wishlist.length > 0 ? (
                              <div className="space-y-4 flex-1">
                                <AnimatePresence>
                                  {wishlist.map((car, idx) => (
                                    <motion.div
                                      key={car.id || idx}
                                      initial={{ opacity: 0, y: 20 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.9 }}
                                      className="relative bg-vw-bg p-5 rounded-2xl border border-vw-border group hover:border-vw-blue/30 transition-all"
                                    >
                                      <button
                                        onClick={() => removeFromWishlist(car)}
                                        className="absolute -top-3 -right-3 w-9 h-9 bg-red-600 text-white rounded-full flex items-center justify-center shadow-xl border-2 border-white z-20"
                                      >
                                        <Trash2 size={16} />
                                      </button>

                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <div className="text-[10px] font-black text-vw-blue uppercase tracking-widest italic">
                                            {car.makeModel}
                                          </div>
                                          <div className="text-[10px] font-black text-vw-ACCENT">
                                            {car.price}
                                          </div>
                                        </div>
                                        {car.trimEdition && (
                                          <div className="text-[9px] font-bold text-vw-blue/70 uppercase tracking-wider leading-none">
                                            {car.trimEdition}
                                          </div>
                                        )}
                                        <div className="text-[10px] text-vw-muted font-bold uppercase tracking-widest flex items-center gap-2">
                                          {car.year}{" "}
                                          <span className="w-1 h-1 bg-vw-muted rounded-full" />{" "}
                                          {car.mileage}
                                          {car.transmission &&
                                            car.transmission !== "N/A" && (
                                              <>
                                                <span className="w-1 h-1 bg-vw-muted rounded-full" />
                                                <span>{car.transmission}</span>
                                              </>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-vw-blue/5">
                                          <div className="flex items-center gap-1.5 text-[9px] font-bold text-vw-blue/60 uppercase">
                                            <MapPin size={10} />{" "}
                                            {car.location ||
                                              branding.dealershipName}
                                          </div>
                                        </div>
                                      </div>
                                    </motion.div>
                                  ))}
                                </AnimatePresence>
                              </div>
                            ) : (
                              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-30">
                                <Search size={40} className="mb-4" />
                                <p className="text-[10px] font-black uppercase tracking-widest">
                                  No vehicles scanned yet
                                </p>
                                <p className="text-[9px] mt-2 italic">
                                  Scanned cards appear here matching your
                                  showroom visit
                                </p>
                              </div>
                            )}

                            {wishlist.length > 0 && (
                              <div className="mt-8 space-y-4">
                                <button
                                  onClick={sendFullWishlistToBruce}
                                  className="w-full bg-vw-blue hover:bg-vw-accent text-white font-black py-5 rounded-2xl shadow-xl transition-all uppercase tracking-widest text-xs italic flex items-center justify-center gap-3 active:scale-95"
                                >
                                  SEND SELECTIONS TO{" "}
                                  {branding.displayName
                                    .split(" ")[0]
                                    .toUpperCase()}{" "}
                                  <Send size={18} />
                                </button>
                                <div className="p-4 bg-vw-blue/5 rounded-2xl border border-vw-blue/10 text-center">
                                  <div className="text-[10px] text-vw-blue font-bold uppercase leading-relaxed">
                                    BRUCE IS READY TO HELP
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {appState === "success" && (
                    <div className="max-w-2xl mx-auto text-center space-y-12 py-12">
                      <div className="space-y-8">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{
                            type: "spring",
                            damping: 10,
                            stiffness: 100,
                          }}
                          className="w-40 h-40 bg-green-500 rounded-full mx-auto flex items-center justify-center text-white shadow-2xl shadow-green-500/40 relative"
                        >
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3 }}
                            className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-20"
                          />
                          <Check size={80} strokeWidth={4} />
                        </motion.div>
                        <div className="space-y-4">
                          <h2 className="text-5xl font-black text-vw-blue uppercase italic tracking-tighter">
                            Selection Sent Successfully!
                          </h2>
                          <p className="text-vw-muted text-xl font-medium max-w-lg mx-auto">
                            {branding.displayName.split(" ")[0]} has received
                            your wishlist on WhatsApp and is checking live
                            inventory for you right now.
                          </p>
                        </div>
                      </div>

                      <div className="bg-vw-blue text-white p-12 rounded-[40px] shadow-2xl space-y-8 inline-block text-left w-full max-w-lg border border-white/10">
                        <div className="flex items-center gap-4 border-b border-white/10 pb-6">
                          <div className="w-12 h-12 bg-vw-GOLD rounded-full flex items-center justify-center text-vw-blue">
                            <Verified size={24} />
                          </div>
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-widest italic">
                              Wait for {branding.displayName.split(" ")[0]}'s
                              Call
                            </h4>
                            <p className="text-[10px] text-vw-LIGHT_BLUE uppercase font-bold opacity-70">
                              Estimated response: 15-30 mins
                            </p>
                          </div>
                        </div>

                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                          {[
                            {
                              t: "Live Appraisal",
                              d: "Trade-in value finalized",
                            },
                            { t: "Walk-around", d: "WhatsApp Video Tours" },
                            { t: "Finance Fast", d: "1-hour pre-approval" },
                            { t: "Paperless", d: "Digital contract signing" },
                          ].map((step, i) => (
                            <li key={i} className="space-y-1">
                              <div className="text-[10px] font-black text-vw-GOLD uppercase tracking-widest italic">
                                {step.t}
                              </div>
                              <div className="text-xs font-light text-vw-LIGHT_BLUE opacity-80">
                                {step.d}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <button
                          onClick={startNewSearch}
                          className="px-12 py-5 bg-vw-blue hover:bg-vw-accent text-white font-black rounded-2xl transition-all shadow-xl uppercase tracking-widest text-xs italic tracking-[2px]"
                        >
                          Start New Search
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="tracker-tab"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-10"
                >
                  {!isAdmin ? (
                    <div className="bg-white p-8 sm:p-12 md:p-20 rounded-[24px] sm:rounded-[40px] text-center border border-vw-border shadow-sm space-y-8">
                      <div className="w-16 h-16 sm:w-24 sm:h-24 bg-vw-bg rounded-full mx-auto flex items-center justify-center text-vw-blue shadow-inner">
                        <Lock size={32} className="sm:w-10 sm:h-10" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl sm:text-3xl font-black uppercase italic tracking-tighter">
                          {referrerParam
                            ? `${branding.displayName.split(" ")[0].toUpperCase()} AUTHENTICATION`
                            : "SALESPERSON ACCESS"}
                        </h3>
                        <p className="text-[9px] sm:text-xs font-bold text-vw-muted uppercase tracking-widest max-w-lg mx-auto">
                          {referrerParam
                            ? `This intelligence ledger is strictly for ${branding.displayName}. Please sign in to access the conversion pipeline.`
                            : "Welcome to the CFAO Mobility Lead Engine. Sign in with your Google account to access your personalized sales dashboard."}
                        </p>
                      </div>
                      <button
                        onClick={signIn}
                        className="bg-vw-blue hover:bg-vw-accent text-white font-black px-12 py-5 rounded-2xl transition-all shadow-xl uppercase tracking-widest text-xs italic flex items-center gap-4 mx-auto"
                      >
                        <LogIn size={20} />{" "}
                        {referrerParam
                          ? `SIGN IN AS ${branding.displayName.split(" ")[0].toUpperCase()}`
                          : "SIGN IN WITH GOOGLE"}
                      </button>
                      {user && !isAdmin && (
                        <div className="text-red-500 font-bold text-[10px] uppercase tracking-widest">
                          Unauthorized Access Denied.
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-vw-border shadow-sm">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-xl sm:text-3xl font-black text-vw-blue uppercase italic tracking-tighter">
                              {isAdmin && user?.displayName
                                ? `${user.displayName.split(" ")[0]}'s Intelligence Hub`
                                : `${branding.displayName.split(" ")[0]}'s Intelligence Hub`}
                            </h2>
                            <button
                              onClick={signOut}
                              className="text-vw-muted hover:text-vw-blue transition-colors"
                            >
                              <LogOut size={16} />
                            </button>
                          </div>
                          <p className="text-[9px] sm:text-xs font-bold text-vw-muted uppercase tracking-widest mt-1">
                            Real-time Lead Ledger & Conversion Pipeline
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 sm:gap-4">
                          <button
                            onClick={() => setAdminTab("leads")}
                            className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${adminTab === "leads" ? "bg-vw-blue text-white" : "bg-vw-bg text-vw-muted hover:text-vw-blue"}`}
                          >
                            Leads Hub
                          </button>
                          {adminTab === "leads" && (
                            <div className="bg-white rounded-[24px] sm:rounded-[40px] border border-vw-border shadow-sm overflow-hidden">
                              <div className="overflow-x-auto no-scrollbar">
                                <table className="w-full text-left min-w-[800px] sm:min-w-0">
                                  <thead className="bg-vw-bg/50 border-b border-vw-border">
                                    <tr>
                                      <th className="px-4 sm:px-8 py-4 sm:py-6 text-[9px] sm:text-[10px] font-black text-vw-muted uppercase tracking-widest">
                                        Lead Identity
                                      </th>
                                      <th className="px-4 sm:px-8 py-4 sm:py-6 text-[9px] sm:text-[10px] font-black text-vw-muted uppercase tracking-widest">
                                        Budget / Intent
                                      </th>
                                      <th className="px-4 sm:px-8 py-4 sm:py-6 text-[9px] sm:text-[10px] font-black text-vw-muted uppercase tracking-widest">
                                        Wishlist Status
                                      </th>
                                      <th className="px-4 sm:px-8 py-4 sm:py-6 text-[9px] sm:text-[10px] font-black text-vw-muted uppercase tracking-widest">
                                        Pipeline Status
                                      </th>
                                      <th className="px-4 sm:px-8 py-4 sm:py-6 text-[9px] sm:text-[10px] font-black text-vw-muted uppercase tracking-widest text-right">
                                        Actions
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-vw-border">
                                    {leads.map((lead) => (
                                      <tr
                                        key={lead.id}
                                        className="hover:bg-vw-bg/30 transition-colors"
                                      >
                                        <td className="px-4 sm:px-8 py-4 sm:py-6">
                                          <div className="font-black text-vw-blue uppercase italic text-xs sm:text-base">
                                            {lead.name}
                                          </div>
                                          <div className="text-[10px] sm:text-xs font-bold text-vw-muted">
                                            {lead.phone}
                                          </div>
                                        </td>
                                        <td className="px-4 sm:px-8 py-4 sm:py-6 text-[10px] sm:text-xs font-bold text-vw-accent uppercase tracking-tighter">
                                          {lead.budget}
                                        </td>
                                        <td className="px-4 sm:px-8 py-4 sm:py-6">
                                          <div className="flex -space-x-3">
                                            {lead.wishlist?.map((_, idx) => (
                                              <div
                                                key={idx}
                                                className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-vw-blue flex items-center justify-center text-white border-2 border-white text-[8px] sm:text-[10px] font-black"
                                              >
                                                C
                                              </div>
                                            ))}
                                            {(!lead.wishlist ||
                                              lead.wishlist.length === 0) && (
                                              <span className="text-[8px] sm:text-[10px] font-bold text-vw-muted uppercase opacity-40">
                                                Scanning...
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-4 sm:px-8 py-4 sm:py-6">
                                          <select
                                            value={lead.status}
                                            onChange={(e) =>
                                              updateLeadStatus(
                                                lead.id!,
                                                e.target
                                                  .value as LeadData["status"],
                                              )
                                            }
                                            className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border-none focus:ring-2 focus:ring-vw-accent appearance-none cursor-pointer ${
                                              lead.status === "New"
                                                ? "bg-blue-100 text-blue-700"
                                                : lead.status === "In Progress"
                                                  ? "bg-amber-100 text-amber-700"
                                                  : lead.status === "Sold"
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-slate-100 text-slate-700"
                                            }`}
                                          >
                                            <option value="New">
                                              New Lead
                                            </option>
                                            <option value="In Progress">
                                              Engaged
                                            </option>
                                            <option value="Sold">Sold</option>
                                            <option value="Lost">Lost</option>
                                          </select>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                          <button
                                            onClick={() =>
                                              deleteDoc(
                                                doc(db, "leads", lead.id!),
                                              )
                                            }
                                            className="text-vw-muted hover:text-red-600 transition-colors"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {leads.length === 0 && (
                                  <div className="text-center py-20 text-vw-muted text-xs font-bold uppercase tracking-widest italic opacity-40">
                                    No intelligence data streaming...
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </>
    </div>
  );
}
