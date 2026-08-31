"use client";
import { useState, useEffect } from "react";
import dummyCustomers from "./data.json"; 

// Render එකේ Live Backend URL එක මෙහි ස්වයංක්‍රීයව ක්‍රියාත්මක වේ
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://dynamiq-4aa7.onrender.com";

export default function App() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.tailwindcss.com?plugins=forms,container-queries";
    document.head.appendChild(script);

    const manifestLink = document.createElement("link");
    manifestLink.rel = "manifest";
    manifestLink.href = "/manifest.json";
    document.head.appendChild(manifestLink);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('Service Worker Registered!', reg))
        .catch((err) => console.error('Service Worker Registration Failed!', err));
    }
  }, []);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authMode, setAuthMode] = useState("start"); 
  const [loggedInUser, setLoggedInUser] = useState("");

  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  const [activeTab, setActiveTab] = useState("Overview");
  
  const [pricingData, setPricingData] = useState({ customer_identifier: "", current_order_amount: "", cost_price: "" });
  const [pricingResult, setPricingResult] = useState<any>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  const [emailData, setEmailData] = useState({ customer_identifier: "" }); 
  const [emailResult, setEmailResult] = useState<any>(null);
  const [emailLoading, setEmailLoading] = useState(false);

  const [recData, setRecData] = useState({ customer_identifier: "" }); 
  const [recResult, setRecResult] = useState<any>(null);
  const [recLoading, setRecLoading] = useState(false);

  const [retData, setRetData] = useState({ customer_identifier: "" }); 
  const [retResult, setRetResult] = useState<any>(null);
  const [retLoading, setRetLoading] = useState(false);

  const extractError = (data: any) => {
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) return data.detail[0].msg;
    return "Something went wrong!";
  };

  const getLoyaltyStatus = (spend: number) => {
    if (spend >= 500000) return "Platinum";
    if (spend >= 150000) return "Gold";
    return "Silver";
  };

  const handleRegister = async (e: any) => {
    e.preventDefault();
    if (!authName || !authEmail || !authPassword) { setAuthMessage("Error: Fill all fields."); return; }
    setAuthMessage("Creating your account...");
    try {
      const response = await fetch(`${API_BASE_URL}/register/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: authName, email: authEmail, password: authPassword }),
      });
      if (response.ok) {
        setAuthMessage("Registration successful! Please sign in.");
        setAuthMode("login"); setAuthPassword(""); 
      } else {
        const data = await response.json(); setAuthMessage(`Error: ${extractError(data)}`);
      }
    } catch (error) { setAuthMessage("Error: Server connection failed."); }
  };

  const handleLogin = async (e: any) => {
    e.preventDefault();
    if (!authEmail || !authPassword) { setAuthMessage("Error: Please enter credentials."); return; }
    setAuthMessage("Verifying credentials...");
    try {
      const response = await fetch(`${API_BASE_URL}/login/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      if (response.ok) {
        const data = await response.json();
        setLoggedInUser(data.user_name); setIsLoggedIn(true); setAuthMessage("");
      } else {
        const data = await response.json(); setAuthMessage(`Error: ${extractError(data)}`);
      }
    } catch (error) { setAuthMessage("Error: Server connection failed."); }
  };

  const handleLogout = () => {
    setIsLoggedIn(false); setAuthEmail(""); setAuthPassword(""); setAuthMode("start"); setActiveTab("Overview");
  };

  const handlePricingSubmit = async (e: any) => {
    e.preventDefault(); 
    setPricingLoading(true); setPricingResult(null);

    const customer = dummyCustomers.find((c: any) => c.name.toLowerCase().includes(pricingData.customer_identifier.toLowerCase()) || c.id === pricingData.customer_identifier);

    if (!customer) {
      alert("Customer not found in data.json! Please enter a valid name.");
      setPricingLoading(false); return;
    }

    const sellingPrice = parseFloat(pricingData.current_order_amount);
    const costPrice = parseFloat(pricingData.cost_price);
    const profit = sellingPrice - costPrice;

    if (profit <= 0) {
      alert(`Cost price (Rs.${costPrice}) is equal to or higher than Selling price (Rs.${sellingPrice})! Cannot give a discount and make a loss.`);
      setPricingLoading(false); return;
    }

    const maxDiscountPct = (profit / sellingPrice) * 100;
    const status = getLoyaltyStatus(customer.total_spend);

    try {
      const response = await fetch(`${API_BASE_URL}/dynamic-pricing/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_identifier: customer.name, current_order_amount: sellingPrice }),
      });

      let finalDiscount = 0;

      if (response.ok) {
        const data = await response.json();
        finalDiscount = parseFloat(data.suggested_discount_percentage);
      } else {
        throw new Error("Backend failed or Quota Exceeded");
      }

      if (finalDiscount >= maxDiscountPct) {
        finalDiscount = Math.floor(maxDiscountPct * 0.8); 
      }

      setPricingResult({
        customer_name: customer.name,
        loyalty_status: status,
        suggested_discount_percentage: finalDiscount,
        final_price: sellingPrice - (sellingPrice * finalDiscount / 100)
      });

    } catch (err) {
      let simulatedDiscount = 0;
      if (status === "Platinum") simulatedDiscount = maxDiscountPct * 0.6;
      else if (status === "Gold") simulatedDiscount = maxDiscountPct * 0.4;
      else simulatedDiscount = maxDiscountPct * 0.15;

      simulatedDiscount = Math.floor(simulatedDiscount);

      setPricingResult({
        customer_name: customer.name,
        loyalty_status: status,
        suggested_discount_percentage: simulatedDiscount,
        final_price: sellingPrice - (sellingPrice * simulatedDiscount / 100)
      });
    }
    setPricingLoading(false);
  };

  const handleEmailSubmit = async (e: any) => {
    e.preventDefault(); 
    if(!emailData.customer_identifier) { alert("Please enter Customer ID/Name!"); return; }
    setEmailLoading(true); setEmailResult(null);
    try {
      const priceRes = await fetch(`${API_BASE_URL}/dynamic-pricing/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_identifier: emailData.customer_identifier, current_order_amount: 5000 }), 
      });

      if (!priceRes.ok) {
        const err = await priceRes.json(); alert(`AI Analysis Failed: ${extractError(err)}`);
        setEmailLoading(false); return;
      }

      const priceData = await priceRes.json();
      const predictedDiscount = parseFloat(priceData.suggested_discount_percentage.replace('%', '')) || 5;

      const emailRes = await fetch(`${API_BASE_URL}/generate-promo-email/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_identifier: emailData.customer_identifier, discount_percentage: predictedDiscount }),
      });

      if (emailRes.ok) { 
        const eData = await emailRes.json();
        eData.predicted_discount = predictedDiscount;
        setEmailResult(eData);
      }
      else { const err = await emailRes.json(); alert(`Email Error: ${extractError(err)}`); }
    } catch (err) { alert("Server error"); }
    setEmailLoading(false);
  };

  const handleOpenEmailApp = () => {
    if (!emailResult || !emailResult.generated_email) return;
    const text = emailResult.generated_email;
    const subjectMatch = text.match(/SUBJECT:\s*(.*)/i);
    const parsedSubject = subjectMatch ? subjectMatch[1].trim() : "Exclusive Offer from DynamIQ!";
    const cleanBody = text.replace(/SUBJECT:\s*.*\n?/i, '').replace(/BODY:\s*/i, '').trim();

    const customer:any = dummyCustomers.find((c:any) => c.name.toLowerCase().includes(emailData.customer_identifier.toLowerCase()) || c.id === emailData.customer_identifier);
    const toEmail = customer ? customer.email : "";

    window.location.href = `mailto:${toEmail}?subject=${encodeURIComponent(parsedSubject)}&body=${encodeURIComponent(cleanBody)}`;
  };

  const handleRecSubmit = async (e: any) => {
    e.preventDefault(); setRecLoading(true); setRecResult(null);
    const foundCustomer:any = dummyCustomers.find((c:any) => c.name.toLowerCase().includes(recData.customer_identifier.toLowerCase()) || c.id === recData.customer_identifier);
    if (!foundCustomer) { alert("Customer not found in data.json!"); setRecLoading(false); return; }

    try {
      const purchasesArray = foundCustomer.recent_purchases.split(",").map((item:string) => item.trim());
      const response = await fetch(`${API_BASE_URL}/recommend-products/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_identifier: foundCustomer.name, recent_purchases: purchasesArray }),
      });
      if (response.ok) setRecResult(await response.json());
      else { const err = await response.json(); alert(`Error: ${extractError(err)}`); }
    } catch (err) { alert("Server error"); }
    setRecLoading(false);
  };

  const handleRetentionSubmit = async (e: any) => {
    e.preventDefault(); setRetLoading(true); setRetResult(null);
    const foundCustomer:any = dummyCustomers.find((c:any) => c.name.toLowerCase().includes(retData.customer_identifier.toLowerCase()) || c.id === retData.customer_identifier);
    if (!foundCustomer) { alert("Customer not found in data.json!"); setRetLoading(false); return; }

    try {
      const response = await fetch(`${API_BASE_URL}/retention-offer/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_identifier: foundCustomer.name, days_since_last_purchase: foundCustomer.days_since_last_purchase }),
      });
      if (response.ok) setRetResult(await response.json());
      else { const err = await response.json(); alert(`Error: ${extractError(err)}`); }
    } catch (err) { alert("Server error"); }
    setRetLoading(false);
  };

  const sortedTopCustomers = [...dummyCustomers]
    .sort((a:any, b:any) => b.total_spend - a.total_spend)
    .slice(0, 10)
    .map((c:any) => ({...c, calculated_status: getLoyaltyStatus(c.total_spend)}));

  return (
    <div className="min-h-screen bg-[#0d0f17] text-gray-100 font-sans relative overflow-x-hidden selection:bg-[#00d4ff]/30 selection:text-white">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");
        @import url("https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap");
        body { font-family: 'Inter', sans-serif; background-color: #0d0f17; -webkit-tap-highlight-color: transparent; }
        .bg-grid { background-size: 40px 40px; background-image: linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px); }
        .animate-fade-in { animation: fadeIn 0.5s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 6px; background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2d3348; border-radius: 4px; }
        
        .pie-chart { width: 200px; height: 200px; border-radius: 50%; background: conic-gradient( #00d4ff 0% 45%, #4edea3 45% 75%, #feb528 75% 90%, #ff5252 90% 100% ); position: relative; display: flex; align-items: center; justify-content: center; }
        .pie-chart::after { content: ""; position: absolute; width: 140px; height: 140px; background-color: #161925; border-radius: 50%; }
        .pie-content { position: relative; z-index: 10; text-align: center; }
      `}} />

      <div className="fixed inset-0 z-[-1] pointer-events-none bg-[#0d0f17]">
         <div className="absolute inset-0 bg-grid"></div>
         <div className="absolute top-[10%] left-[10%] w-[400px] h-[400px] bg-[#00d4ff]/10 rounded-full blur-[120px]"></div>
         <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] bg-[#4edea3]/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative z-10 w-full min-h-screen flex flex-col">
        {!isLoggedIn && authMode === "start" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in relative z-20">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#00d4ff]/30 bg-[#00d4ff]/10 text-[#00d4ff] text-xs font-semibold mb-2">
                <span className="material-symbols-outlined text-sm">rocket_launch</span> DynamIQ
              </div>
              <h1 className="text-4xl md:text-7xl font-extrabold text-white tracking-tight leading-tight">
                Supercharge Your <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d2dcdf] to-[#4edea3] drop-shadow-[0_0_15px_rgba(0,212,255,0.4)]">Sales with AI.</span>
              </h1>
              <p className="text-base md:text-xl text-gray-400 max-w-2xl mx-auto">Predictive AI Customer Relationship Management tailored for Sri Lankan Dealerships. Automate pricing, recommendations, and customer retention.</p>
              <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
                <button onClick={() => {setAuthMode("register"); setAuthMessage("");}} className="w-full sm:w-auto px-8 py-4 text-lg font-bold text-[#e4e7f1] bg-gradient-to-r from-[#8cccd6] to-[#008fb3] rounded-xl active:scale-95 transition-all">Get Started Free</button>
                <button onClick={() => {setAuthMode("login"); setAuthMessage("");}} className="w-full sm:w-auto px-8 py-4 text-lg font-bold text-[#dde3e7] bg-[#0d0f17] border border-[#6379c7] rounded-xl active:scale-95 transition-all">Sign In</button>
              </div>
            </div>
          </div>
        )}

        {!isLoggedIn && (authMode === "login" || authMode === "register") && (
          <div className="flex-1 flex items-center justify-center p-4">
            <main className="w-full max-w-md animate-fade-in relative z-20">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-extrabold text-[#00d4ff] tracking-tight">DynamIQ</h1>
              </div>
              <div className="bg-[#161925] border border-[#2d3348] rounded-2xl p-6 md:p-8 shadow-2xl">
                <div className="flex border-b border-[#2d3348] mb-6">
                  <button type="button" onClick={() => {setAuthMode("login"); setAuthMessage("");}} className={`flex-1 pb-3 text-base font-semibold text-center transition-all ${authMode === 'login' ? 'border-b-2 border-[#ccd0d1] text-[#dde3e7]' : 'text-[#cddbe0]'}`}>Sign In</button>
                  <button type="button" onClick={() => {setAuthMode("register"); setAuthMessage("");}} className={`flex-1 pb-3 text-base font-semibold text-center transition-all ${authMode === 'register' ? 'border-b-2 border-[#daebee] text-[#dde3e7]' : 'text-[#cddbe0]'}`}>Register</button>
                </div>
                {authMessage && <div className={`mb-4 p-3 rounded-lg text-xs font-medium border ${authMessage.includes("Error") ? "bg-red-950/50 text-red-400 border-red-800" : "bg-[#4edea3]/10 text-[#4edea3] border-[#4edea3]/50"}`}>{authMessage}</div>}
                
                {authMode === "login" && (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-400 uppercase font-semibold mb-1 block">Email</label>
                      <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required className="w-full bg-[#0d0f17] border border-[#2d3348] rounded-lg px-4 py-3 text-white outline-none focus:border-[#00d4ff]" placeholder="team@company.com" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 uppercase font-semibold mb-1 block">Password</label>
                      <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required className="w-full bg-[#0d0f17] border border-[#2d3348] rounded-lg px-4 py-3 text-white outline-none focus:border-[#7bdcf0]" placeholder="••••••••" />
                    </div>
                    <button type="submit" className="w-full bg-gradient-to-r from-[#00d4ff] to-[#008fb3] text-[#cddbe0] font-bold py-3 rounded-lg mt-2 text-base active:scale-95 transition-transform shadow-[0_0_10px_rgba(0,212,255,0.3)] cursor-pointer">Sign In</button>
                  </form>
                )}

                {authMode === "register" && (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-400 uppercase font-semibold mb-1 block">Full Name</label>
                      <input type="text" value={authName} onChange={(e) => setAuthName(e.target.value)} required className="w-full bg-[#0d0f17] border border-[#2d3348] rounded-lg px-4 py-3 text-white outline-none focus:border-[#00d4ff]" placeholder="Your Name" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 uppercase font-semibold mb-1 block">Email</label>
                      <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required className="w-full bg-[#0d0f17] border border-[#2d3348] rounded-lg px-4 py-3 text-white outline-none focus:border-[#00d4ff]" placeholder="name@company.com" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 uppercase font-semibold mb-1 block">Password</label>
                      <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required className="w-full bg-[#0d0f17] border border-[#2d3348] rounded-lg px-4 py-3 text-white outline-none focus:border-[#00d4ff]" placeholder="••••••••" />
                    </div>
                    <button type="submit" className="w-full bg-gradient-to-r from-[#00d4ff] to-[#008fb3] text-[#cddbe0] font-bold py-3 rounded-lg mt-2 text-base active:scale-95 transition-transform shadow-[0_0_10px_rgba(0,212,255,0.3)] cursor-pointer">Create Account</button>
                  </form>
                )}
                <button type="button" onClick={() => {setAuthMode("start"); setAuthMessage("");}} className="w-full text-xs text-gray-500 text-[#bde6f5] hover:text-white mt-6 flex items-center justify-center gap-1 cursor-pointer"><span className="material-symbols-outlined text-xs">arrow_back</span> Back to Home</button>
              </div>
            </main>
          </div>
        )}

        {isLoggedIn && (
          <div className="flex-1 flex flex-col md:flex-row relative">
            <nav className="hidden md:flex flex-col p-6 bg-[#161925] h-full min-h-screen w-72 border-r border-[#2d3348] sticky top-0">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-10 h-10 rounded-full border-2 border-[#00d4ff] bg-[#00d4ff]/20 flex items-center justify-center font-bold text-[#00d4ff] uppercase">{loggedInUser.charAt(0)}</div>
                <div><h2 className="font-bold text-[#00d4ff]">{loggedInUser}</h2><p className="text-xs text-gray-400">DynamIQ Admin</p></div>
              </div>
              <div className="flex-1 space-y-2">
                {[
                  { id: 'Overview', icon: 'dashboard', label: 'Overview' },
                  { id: 'Sales', icon: 'trending_up', label: 'AI Pricing' },
                  { id: 'Marketing', icon: 'mail', label: 'Marketing' },
                  { id: 'Retention', icon: 'psychology', label: 'Retention' }
                ].map(item => (
                  <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all cursor-pointer ${activeTab === item.id ? 'bg-[#00d4ff]/10 text-[#00d4ff] border-l-4 border-[#00d4ff]' : 'text-gray-400 hover:bg-[#2d3348]/50 hover:text-white'}`}>
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: activeTab === item.id ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
                    <span className="font-medium text-sm">{item.label}</span>
                  </button>
                ))}
              </div>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 text-red-400 px-4 py-3 hover:bg-red-950/50 rounded-lg transition-all mt-auto cursor-pointer"><span className="material-symbols-outlined text-[20px]">logout</span><span className="font-medium text-sm">Sign Out</span></button>
            </nav>

            <header className="md:hidden flex justify-between items-center w-full px-5 py-3 z-50 bg-[#161925]/90 backdrop-blur-md border-b border-[#2d3348] sticky top-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#00d4ff]/20 flex items-center justify-center font-bold text-xs text-[#00d4ff] uppercase">{loggedInUser.charAt(0)}</div>
                <h1 className="text-lg font-bold text-white tracking-tight">DynamIQ</h1>
              </div>
              <button onClick={handleLogout} className="text-red-400 p-1 cursor-pointer"><span className="material-symbols-outlined text-[20px]">logout</span></button>
            </header>

            <main className="flex-1 flex flex-col pb-[90px] md:pb-6 relative z-10 w-full overflow-y-auto">
              <div className="p-4 md:p-8 max-w-7xl mx-auto w-full flex-1 flex flex-col gap-6">

                {activeTab === "Overview" && (
                  <div className="animate-fade-in flex flex-col gap-6">
                    <div><h2 className="text-2xl md:text-3xl font-bold text-white mb-1">Dashboard</h2><p className="text-sm md:text-base text-gray-400">Your Auto-Parts AI insights.</p></div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-[#161925] border border-[#2d3348] rounded-xl p-4 flex flex-col justify-between"><span className="material-symbols-outlined text-[#4edea3] mb-2 text-[24px]">payments</span><h3 className="text-xl md:text-2xl font-bold text-white">Rs. 2.4M</h3><p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">Monthly Revenue</p></div>
                      <div className="bg-[#161925] border border-[#2d3348] rounded-xl p-4 flex flex-col justify-between"><span className="material-symbols-outlined text-[#00d4ff] mb-2 text-[24px]">group</span><h3 className="text-xl md:text-2xl font-bold text-white">{dummyCustomers.length}</h3><p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">Total Clients</p></div>
                      <div className="bg-[#161925] border border-[#2d3348] rounded-xl p-4 flex flex-col justify-between"><span className="material-symbols-outlined text-[#feb528] mb-2 text-[24px]">auto_awesome</span><h3 className="text-xl md:text-2xl font-bold text-white">412</h3><p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">AI Predictions</p></div>
                      <div className="bg-[#161925] border border-[#2d3348] rounded-xl p-4 flex flex-col justify-between"><span className="material-symbols-outlined text-[#ff5252] mb-2 text-[24px]">warning</span><h3 className="text-xl md:text-2xl font-bold text-white">12%</h3><p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">Avg. Churn Risk</p></div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-1 bg-[#161925] border border-[#2d3348] rounded-xl p-6 flex flex-col items-center">
                        <h3 className="text-base font-bold text-white mb-6 w-full text-left flex items-center gap-2"><span className="material-symbols-outlined text-[#00d4ff] text-[18px]">pie_chart</span> Sales by Category</h3>
                        <div className="pie-chart shadow-[0_0_20px_rgba(0,0,0,0.5)]"><div className="pie-content"><span className="block text-2xl font-bold text-white">45%</span><span className="text-[10px] text-gray-400 uppercase">Engine Parts</span></div></div>
                        <div className="mt-8 w-full space-y-3">
                          <div className="flex items-center justify-between text-xs"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#00d4ff]"></div><span className="text-gray-300">Engine Parts</span></div><span className="font-bold text-white">45%</span></div>
                          <div className="flex items-center justify-between text-xs"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#4edea3]"></div><span className="text-gray-300">Braking System</span></div><span className="font-bold text-white">30%</span></div>
                          <div className="flex items-center justify-between text-xs"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#feb528]"></div><span className="text-gray-300">Electricals</span></div><span className="font-bold text-white">15%</span></div>
                          <div className="flex items-center justify-between text-xs"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#ff5252]"></div><span className="text-gray-300">Accessories</span></div><span className="font-bold text-white">10%</span></div>
                        </div>
                      </div>
                      <div className="lg:col-span-2 bg-[#161925] border border-[#2d3348] rounded-xl p-6 flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-base font-bold text-white flex items-center gap-2"><span className="material-symbols-outlined text-[#feb528] text-[18px]">trophy</span> Top Customers <span className="text-[10px] text-gray-400 font-normal ml-2">(Auto-Categorized)</span></h3>
                          <span className="text-xs text-gray-500 bg-[#0d0f17] px-3 py-1 rounded-full border border-[#2d3348]">By Total Spend</span>
                        </div>
                        <div className="flex-1 overflow-y-auto max-h-[350px] pr-2 space-y-2">
                          {sortedTopCustomers.map((customer, index) => (
                            <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-[#0d0f17] border border-[#2d3348] hover:border-[#00d4ff]/30 transition-colors">
                              <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-[#2d3348] flex items-center justify-center text-xs font-bold text-white uppercase shrink-0">{index + 1}</div>
                                <div><p className="text-sm font-bold text-white">{customer.name}</p><p className="text-[10px] text-gray-400">ID: {customer.id} | Orders: {customer.total_orders}</p></div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-[#4edea3]">Rs. {customer.total_spend.toLocaleString()}</p>
                                <span className={`text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-full mt-1 inline-block ${customer.calculated_status === 'Platinum' ? 'text-[#00d4ff] border border-[#00d4ff]/50 bg-[#00d4ff]/10' : customer.calculated_status === 'Gold' ? 'text-[#feb528] border border-[#feb528]/50 bg-[#feb528]/10' : 'text-gray-300 border border-gray-500/50 bg-gray-500/10'}`}>{customer.calculated_status}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "Sales" && (
                  <div className="animate-fade-in flex flex-col gap-4">
                    <div><h1 className="text-2xl font-bold text-white">AI Pricing</h1><p className="text-sm text-gray-400">Dynamic discount generator with Profit Protection.</p></div>
                    <div className="bg-[#161925] border border-[#2d3348] rounded-xl p-5">
                      <form onSubmit={handlePricingSubmit} className="space-y-4">
                        <div><label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">Customer Name / ID</label><input type="text" value={pricingData.customer_identifier} onChange={(e) => setPricingData({...pricingData, customer_identifier: e.target.value})} required className="w-full bg-[#0d0f17] border border-[#2d3348] text-sm text-white rounded-lg py-3 px-3 outline-none focus:border-[#00d4ff]" placeholder="e.g. Nimal or 1"/></div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] text-[#4edea3] uppercase font-semibold block mb-1">Cost Price (Rs.)</label>
                            <input type="number" value={pricingData.cost_price} onChange={(e) => setPricingData({...pricingData, cost_price: e.target.value})} required className="w-full bg-[#0d0f17] border border-[#4edea3]/50 text-sm font-bold text-[#4edea3] rounded-lg py-3 px-3 outline-none tabular-nums focus:border-[#4edea3]" placeholder="15000"/>
                          </div>
                          <div>
                            <label className="text-[10px] text-[#00d4ff] uppercase font-semibold block mb-1">Selling Price (Rs.)</label>
                            <input type="number" value={pricingData.current_order_amount} onChange={(e) => setPricingData({...pricingData, current_order_amount: e.target.value})} required className="w-full bg-[#0d0f17] border border-[#00d4ff]/50 text-sm font-bold text-[#00d4ff] rounded-lg py-3 px-3 outline-none tabular-nums focus:border-[#00d4ff]" placeholder="25000"/>
                          </div>
                        </div>
                        <button type="submit" className="w-full bg-gradient-to-r from-[#00d4ff] to-[#008fb3] text-[#f2f5fd] font-bold py-3 rounded-lg text-sm active:scale-95 transition-transform shadow-[0_0_10px_rgba(0,212,255,0.3)] cursor-pointer">{pricingLoading ? "Analyzing Margins..." : "Calculate Smart Discount"}</button>
                      </form>
                    </div>
                    {pricingResult && (
                      <div className="bg-[#00d4ff]/10 border border-[#00d4ff]/50 rounded-xl p-5">
                        <div className="flex justify-between items-start mb-3"><span className="text-xs text-[#00d4ff] uppercase tracking-wider font-bold">Safe AI Decision</span><span className="text-[10px] bg-[#00d4ff] text-[#0d0f17] px-2 py-0.5 rounded-full font-bold">{pricingResult.loyalty_status} Member</span></div>
                        <div className="space-y-2 text-sm text-gray-300"><div className="flex justify-between"><span>Client:</span> <strong>{pricingResult.customer_name}</strong></div><div className="flex justify-between"><span>Approved Discount:</span> <strong className="text-[#00d4ff]">- {pricingResult.suggested_discount_percentage}%</strong></div></div>
                        <div className="mt-4 pt-3 border-t border-[#00d4ff]/30"><span className="text-[10px] text-gray-400 uppercase">Final Optimized Price</span><div className="text-3xl font-extrabold text-[#00d4ff] tracking-tight">Rs. {pricingResult.final_price}</div></div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "Marketing" && (
                  <div className="animate-fade-in flex flex-col gap-4">
                    <div><h1 className="text-2xl font-bold text-white">Marketing</h1><p className="text-sm text-gray-400">Email & Recommendations.</p></div>
                    
                    <div className="bg-[#161925] border border-[#2d3348] rounded-xl p-5">
                      <h3 className="text-sm font-bold text-[#00d4ff] mb-1 flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">mail</span> AI Auto-Emailer</h3>
                      <p className="text-[10px] text-gray-500 mb-3">(AI predicts discount based on data.json)</p>
                      <form onSubmit={handleEmailSubmit} className="space-y-3">
                        <input type="text" value={emailData.customer_identifier} onChange={(e) => setEmailData({...emailData, customer_identifier: e.target.value})} className="w-full bg-[#0d0f17] border border-[#2d3348] text-sm text-white rounded-lg py-2.5 px-3 outline-none focus:border-[#00d4ff]" placeholder="Customer ID or Name (e.g. Kasun)"/>
                        <button type="submit" className="w-full bg-gradient-to-r from-[#00d4ff] to-[#008fb3] text-[#d9dce9] font-bold py-3 rounded-lg text-sm active:scale-95 transition-transform flex justify-center items-center shadow-[0_0_10px_rgba(0,212,255,0.3)] cursor-pointer">
                           {emailLoading ? "Generating..." : "Predict Discount & Generate"}
                        </button>
                      </form>
                      {emailResult && (
                        <div className="mt-4 p-4 bg-[#0d0f17] border border-[#00d4ff]/30 rounded-lg">
                          <div className="flex justify-between items-center mb-3">
                            <p className="text-xs text-[#4edea3] font-bold">🚀 Generated Successfully</p>
                            <span className="text-[10px] font-bold bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/50 px-2 py-1 rounded">🎯 Predicted: {emailResult.predicted_discount}%</span>
                          </div>
                          <p className="text-xs text-gray-400 whitespace-pre-line bg-[#161925] p-3 rounded border border-[#2d3348] mb-4">
                            {emailResult.generated_email}
                          </p>
                          <button onClick={handleOpenEmailApp} className="w-full bg-[#4edea3] hover:bg-[#3bc78e] text-[#0d0f17] font-bold py-3 rounded-lg text-sm transition-all active:scale-95 flex justify-center items-center gap-2 shadow-[0_0_10px_rgba(78,222,163,0.3)] cursor-pointer">
                            <span className="material-symbols-outlined text-[18px]">open_in_new</span> Send via My Email App
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="bg-[#161925] border border-[#2d3348] rounded-xl p-5">
                      <h3 className="text-sm font-bold text-[#4edea3] mb-1 flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">psychology</span> Recommender</h3>
                      <form onSubmit={handleRecSubmit} className="space-y-3 mt-3">
                        <input type="text" value={recData.customer_identifier} onChange={(e) => setRecData({...recData, customer_identifier: e.target.value})} className="w-full bg-[#0d0f17] border border-[#2d3348] text-sm text-white rounded-lg py-2.5 px-3 outline-none focus:border-[#4edea3]" placeholder="Customer Name (e.g. Suneth)"/>
                        <button type="submit" className="w-full bg-gradient-to-r from-[#4edea3] to-[#2fb87a] text-[#e9ebf3] font-bold py-3 rounded-lg text-sm transition-all active:scale-95 shadow-[0_0_10px_rgba(78,222,163,0.3)] cursor-pointer">
                          {recLoading ? "Analyzing Data..." : "Predict Next Products"}
                        </button>
                      </form>
                      {recResult && (
                        <div className="mt-4 p-3 bg-[#0d0f17] border border-[#4edea3]/30 rounded-lg">
                          <ul className="space-y-2">
                            {recResult.recommended_products.map((p:string, i:number) => (
                              <li key={i} className="text-xs text-white bg-[#161925] p-2 rounded border border-[#2d3348] flex justify-between">{p} <span className="text-[10px] text-[#4edea3]">AI Pick</span></li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "Retention" && (
                  <div className="animate-fade-in flex flex-col gap-4">
                    <div><h1 className="text-2xl font-bold text-white">Retention AI</h1><p className="text-sm text-gray-400">Auto-predicts churn risk.</p></div>
                    <div className="bg-[#161925] border border-[#2d3348] rounded-xl p-5">
                      <form onSubmit={handleRetentionSubmit} className="space-y-4">
                        <div><label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">Customer Name / ID</label><input type="text" value={retData.customer_identifier} onChange={(e) => setRetData({...retData, customer_identifier: e.target.value})} className="w-full bg-[#0d0f17] border border-[#2d3348] text-sm text-white rounded-lg py-3 px-3 outline-none focus:border-[#ff5252]" placeholder="e.g. Nimal"/></div>
                        <button type="submit" className="w-full bg-gradient-to-r from-[#ff5252] to-[#d32f2f] text-white font-bold py-3 rounded-lg text-sm transition-all active:scale-95 shadow-[0_0_10px_rgba(255,82,82,0.3)] cursor-pointer">
                          {retLoading ? "Scanning Data..." : "Analyze Risk"}
                        </button>
                      </form>
                    </div>
                    {retResult && (
                      <div className="bg-[#0d0f17] border border-red-500/30 rounded-xl p-5">
                        <div className="flex justify-between items-center mb-3">
                          <h3 className="font-bold text-white text-sm">{retResult.customer_name}</h3>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${retResult.retention_strategy.churn_risk?.toLowerCase().includes('high') ? 'bg-red-500/20 text-[#ff5252] border border-red-500' : 'bg-[#4edea3]/20 text-[#4edea3] border border-[#4edea3]'}`}>{retResult.retention_strategy.churn_risk} Risk</span>
                        </div>
                        <div className="text-xs text-gray-300 space-y-2"><p><strong className="text-white">Action:</strong> {retResult.retention_strategy.suggested_offer}</p><div className="p-3 bg-[#161925] rounded border border-[#2d3348] text-gray-400 italic">{retResult.retention_strategy.message_to_customer}</div></div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </main>

            <div className="md:hidden fixed bottom-0 left-0 w-full bg-[#161925] border-t border-[#2d3348] z-[100] px-2 py-2 flex justify-between items-center pb-safe" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
              {[
                { id: 'Overview', icon: 'dashboard', label: 'Home' },
                { id: 'Sales', icon: 'trending_up', label: 'Sales' },
                { id: 'Marketing', icon: 'mail', label: 'Promo' },
                { id: 'Retention', icon: 'psychology', label: 'Risk' }
              ].map(item => (
                <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex flex-col items-center justify-center w-16 p-1 rounded-lg transition-all cursor-pointer ${activeTab === item.id ? 'text-[#00d4ff]' : 'text-[#859398]'}`}>
                  <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: activeTab === item.id ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
                  <span className="text-[9px] mt-1 font-medium tracking-wide">{item.label}</span>
                </button>
              ))}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}