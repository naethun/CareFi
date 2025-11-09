"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Camera,
  BarChart3,
  Sun,
  Moon,
  ShoppingBag,
  User,
  Menu,
  X,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DashboardData {
  currentGoals: string[];
  progressBars: Array<{
    label: string;
    value: number;
    color: "green" | "red" | "yellow";
  }>;
  dailyTasks: Array<{
    day: string;
    completed: boolean;
  }>;
  images: string[];
}

interface RoutineStep {
  step: number;
  productType: string;
  actives: string[];
  rationale: string;
  alternatives: Array<{
    name: string;
    brand: string;
    price: number;
  }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeRoutineTab, setActiveRoutineTab] = useState<"am" | "pm">("am");
  const [routineCompletion, setRoutineCompletion] = useState({
    am: [false, false, false, false], // Track which AM steps are completed
    pm: [false, false, false, false], // Track which PM steps are completed
  });
  const [data, setData] = useState<DashboardData>({
    currentGoals: ["ACNE", "Oiliness"],
    progressBars: [
      { label: "Acne Progress", value: 0, color: "green" },
      { label: "Oiliness", value: 0, color: "red" },
      { label: "Sensitivity", value: 0, color: "yellow" },
    ],
    dailyTasks: [
      { day: "Mon", completed: true },
      { day: "Tues", completed: true },
      { day: "Wed", completed: false },
      { day: "Th", completed: false },
      { day: "Fri", completed: false },
      { day: "Sat", completed: false },
      { day: "Sun", completed: false },
    ],
    images: [],
  });

  // Mock routine data
  const amRoutine: RoutineStep[] = [
    {
      step: 1,
      productType: "Cleanser",
      actives: ["Salicylic Acid"],
      rationale:
        "Gentle exfoliation to control oil and prevent breakouts without over-stripping skin.",
      alternatives: [
        { name: "Hydrating Facial Cleanser", brand: "CeraVe", price: 14.99 },
        { name: "Toleriane Cleanser", brand: "La Roche-Posay", price: 15.99 },
      ],
    },
    {
      step: 2,
      productType: "Toner",
      actives: ["Niacinamide", "Centella Asiatica"],
      rationale:
        "Soothing hydration that reduces inflammation and balances oil production.",
      alternatives: [
        { name: "Niacinamide 10% + Zinc 1%", brand: "The Ordinary", price: 6.0 },
      ],
    },
    {
      step: 3,
      productType: "Moisturizer",
      actives: ["Ceramides", "Hyaluronic Acid"],
      rationale:
        "Lightweight hydration to strengthen barrier without clogging pores.",
      alternatives: [
        { name: "Daily Hydrating Lotion", brand: "Cetaphil", price: 12.49 },
      ],
    },
    {
      step: 4,
      productType: "Sunscreen",
      actives: ["Zinc Oxide"],
      rationale: "Mineral protection that won't irritate sensitive, acne-prone skin.",
      alternatives: [],
    },
  ];

  const pmRoutine: RoutineStep[] = [
    {
      step: 1,
      productType: "Oil Cleanser",
      actives: ["Jojoba Oil"],
      rationale: "Dissolves sebum and makeup without disrupting skin barrier.",
      alternatives: [],
    },
    {
      step: 2,
      productType: "Cleanser",
      actives: ["Salicylic Acid"],
      rationale: "Second cleanse to thoroughly remove impurities and exfoliate.",
      alternatives: [
        { name: "Hydrating Facial Cleanser", brand: "CeraVe", price: 14.99 },
      ],
    },
    {
      step: 3,
      productType: "Treatment",
      actives: ["Azelaic Acid"],
      rationale:
        "Multi-tasking active that targets acne, redness, and PIH simultaneously.",
      alternatives: [
        {
          name: "Azelaic Acid Suspension 10%",
          brand: "The Ordinary",
          price: 12.0,
        },
      ],
    },
    {
      step: 4,
      productType: "Moisturizer",
      actives: ["Ceramides", "Centella Asiatica"],
      rationale: "Reparative hydration to support overnight skin recovery.",
      alternatives: [
        { name: "Cicaplast Baume B5", brand: "La Roche-Posay", price: 15.99 },
      ],
    },
  ];

  const toggleTask = (index: number) => {
    setData((prev) => ({
      ...prev,
      dailyTasks: prev.dailyTasks.map((task, i) =>
        i === index ? { ...task, completed: !task.completed } : task
      ),
    }));
  };

  const toggleRoutineStep = (period: "am" | "pm", stepIndex: number) => {
    setRoutineCompletion((prev) => ({
      ...prev,
      [period]: prev[period].map((completed, i) =>
        i === stepIndex ? !completed : completed
      ),
    }));
  };

  // Calculate progress bars based on routine completion
  useEffect(() => {
    const amCompleted = routineCompletion.am.filter(Boolean).length;
    const pmCompleted = routineCompletion.pm.filter(Boolean).length;
    const totalSteps = 4;
    
    // Calculate progress based on routine completion
    // Acne progress: based on AM routine completion (treatment steps)
    const acneProgress = (amCompleted / totalSteps) * 100;
    
    // Oiliness: based on PM routine completion (cleansing steps)
    const oilinessProgress = (pmCompleted / totalSteps) * 100;
    
    // Sensitivity: average of both routines
    const sensitivityProgress = ((amCompleted + pmCompleted) / (totalSteps * 2)) * 100;

    setData((prev) => ({
      ...prev,
      progressBars: [
        { label: "Acne Progress", value: Math.round(acneProgress), color: "green" },
        { label: "Oiliness", value: Math.round(oilinessProgress), color: "red" },
        { label: "Sensitivity", value: Math.round(sensitivityProgress), color: "yellow" },
      ],
    }));
  }, [routineCompletion]);

  const getProgressColor = (color: string) => {
    switch (color) {
      case "green":
        return "bg-emerald-500";
      case "red":
        return "bg-red-500";
      case "yellow":
        return "bg-yellow-500";
      default:
        return "bg-stone-500";
    }
  };

  const navItems = [
    { label: "dash", icon: BarChart3, href: "/dashboard", active: true, onClick: null },
    { label: "Analytics", icon: BarChart3, href: "/analytics", onClick: null },
    { label: "AM", icon: Sun, href: null, onClick: () => setActiveRoutineTab("am") },
    { label: "PM", icon: Moon, href: null, onClick: () => setActiveRoutineTab("pm") },
    { label: "Products", icon: ShoppingBag, href: "/products", onClick: null },
  ];

  return (
    <div className="min-h-screen bg-stone-50 flex">
      {/* Left Sidebar Navigation */}
      <aside className="hidden lg:flex flex-col items-center w-20 bg-white border-r border-stone-200 py-6 fixed left-0 top-0 bottom-0 z-40">
        {/* Camera Icon */}
        <div className="mb-8">
          <Camera className="w-6 h-6 text-stone-700" />
        </div>

        {/* User Profile Picture */}
        <div className="mb-8">
          <div className="w-12 h-12 rounded-lg bg-stone-200 flex items-center justify-center border-2 border-stone-300">
            <User className="w-6 h-6 text-stone-500" />
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-4 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.active || (item.label === "AM" && activeRoutineTab === "am") || (item.label === "PM" && activeRoutineTab === "pm");
            
            if (item.onClick) {
              return (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className={`w-14 h-14 rounded-lg flex items-center justify-center transition-colors ${
                    isActive
                      ? "bg-stone-900 text-white"
                      : "text-stone-600 hover:bg-stone-100"
                  }`}
                  title={item.label}
                >
                  <Icon className="w-5 h-5" />
                </button>
              );
            }
            
            return (
              <Link
                key={item.label}
                href={item.href || "#"}
                className={`w-14 h-14 rounded-lg flex items-center justify-center transition-colors ${
                  isActive
                    ? "bg-stone-900 text-white"
                    : "text-stone-600 hover:bg-stone-100"
                }`}
                title={item.label}
              >
                <Icon className="w-5 h-5" />
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Sidebar Toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md border border-stone-200"
      >
        {sidebarOpen ? (
          <X className="w-6 h-6 text-stone-700" />
        ) : (
          <Menu className="w-6 h-6 text-stone-700" />
        )}
      </button>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="lg:hidden flex flex-col items-center w-20 bg-white border-r border-stone-200 py-6 fixed left-0 top-0 bottom-0 z-50">
            <div className="mb-8">
              <Camera className="w-6 h-6 text-stone-700" />
            </div>
            <div className="mb-8">
              <div className="w-12 h-12 rounded-lg bg-stone-200 flex items-center justify-center border-2 border-stone-300">
                <User className="w-6 h-6 text-stone-500" />
              </div>
            </div>
            <nav className="flex flex-col gap-4 flex-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.active || (item.label === "AM" && activeRoutineTab === "am") || (item.label === "PM" && activeRoutineTab === "pm");
                
                if (item.onClick) {
                  return (
                    <button
                      key={item.label}
                      onClick={() => {
                        item.onClick?.();
                        setSidebarOpen(false);
                      }}
                      className={`w-14 h-14 rounded-lg flex items-center justify-center transition-colors ${
                        isActive
                          ? "bg-stone-900 text-white"
                          : "text-stone-600 hover:bg-stone-100"
                      }`}
                      title={item.label}
                    >
                      <Icon className="w-5 h-5" />
                    </button>
                  );
                }
                
                return (
                  <Link
                    key={item.label}
                    href={item.href || "#"}
                    onClick={() => setSidebarOpen(false)}
                    className={`w-14 h-14 rounded-lg flex items-center justify-center transition-colors ${
                      isActive
                        ? "bg-stone-900 text-white"
                        : "text-stone-600 hover:bg-stone-100"
                    }`}
                    title={item.label}
                  >
                    <Icon className="w-5 h-5" />
                  </Link>
                );
              })}
            </nav>
          </aside>
        </>
      )}

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-20 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Top-Left: Empty or Header Space */}
            <div className="md:col-span-2 lg:col-span-1">
              {/* Can be used for header or left empty */}
            </div>

            {/* Top-Middle: Consult Derm AI */}
            <Card className="p-8 md:col-span-2 lg:col-span-1">
              <div className="flex flex-col items-center justify-center text-center space-y-4 min-h-[200px]">
                {/* Simple face drawing representation */}
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-stone-200 flex items-center justify-center">
                    <div className="flex flex-col items-center">
                      {/* Eyes */}
                      <div className="flex gap-4 mb-2">
                        <div className="w-4 h-4 rounded-full bg-stone-700"></div>
                        <div className="w-4 h-4 rounded-full bg-stone-700"></div>
                      </div>
                      {/* Body/Legs */}
                      <div className="w-8 h-12 bg-stone-300 rounded-b-full"></div>
                    </div>
                  </div>
                </div>
                <h3 className="text-lg font-medium text-stone-900">
                  Consult Derm AI
                </h3>
                <Button
                  onClick={() => router.push("/upload")}
                  className="bg-stone-900 text-white hover:bg-stone-800"
                >
                  Start Consultation
                </Button>
              </div>
            </Card>

            {/* Top-Right: Current Goals */}
            <Card className="p-6 lg:col-span-1">
              <h3 className="text-lg font-medium text-stone-900 mb-4">
                Current goals
              </h3>
              <ul className="space-y-3">
                {data.currentGoals.map((goal, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <span className="text-stone-600">o</span>
                    <span className="text-stone-700 font-medium">{goal}</span>
                  </li>
                ))}
                <li className="flex items-center gap-2 text-stone-400">
                  <span>o</span>
                  <span className="text-sm">Add goal...</span>
                </li>
              </ul>
            </Card>

            {/* Bottom-Middle: Progress Bar */}
            <Card className="p-6 md:col-span-2 lg:col-span-2">
              <h3 className="text-lg font-medium text-stone-900 mb-6">
                Progress bar
              </h3>
              <div className="space-y-4 mb-6">
                {data.progressBars.map((bar, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-stone-600">{bar.label}</span>
                      <span className="text-stone-900 font-medium">
                        {bar.value}%
                      </span>
                    </div>
                    <div className="relative w-full h-3 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${getProgressColor(bar.color)}`}
                        style={{ width: `${bar.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Images Section */}
              <div className="mt-6 pt-6 border-t border-stone-200">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm text-stone-600">→</span>
                  <span className="text-sm font-medium text-stone-700">
                    images
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {data.images.length === 0 ? (
                    <>
                      {[...Array(4)].map((_, i) => (
                        <div
                          key={i}
                          className="aspect-square rounded-lg bg-stone-100 border-2 border-dashed border-stone-300 flex items-center justify-center"
                        >
                          <Camera className="w-6 h-6 text-stone-400" />
                        </div>
                      ))}
                    </>
                  ) : (
                    data.images.map((img, i) => (
                      <div
                        key={i}
                        className="aspect-square rounded-lg bg-stone-200"
                      />
                    ))
                  )}
                </div>
              </div>
            </Card>

            {/* Bottom-Right: Daily Tasks */}
            <Card className="p-6 lg:col-span-1">
              <h3 className="text-lg font-medium text-stone-900 mb-4">
                Daily Tasks
              </h3>
              <div className="space-y-3">
                {/* Days Header */}
                <div className="flex gap-2 text-xs font-medium text-stone-600 mb-4">
                  {data.dailyTasks.map((task) => (
                    <div key={task.day} className="flex-1 text-center">
                      {task.day}
                    </div>
                  ))}
                </div>

                {/* Checkboxes */}
                <div className="flex gap-2">
                  {data.dailyTasks.map((task, index) => (
                    <div
                      key={index}
                      className="flex-1 flex flex-col items-center gap-2"
                    >
                      <button
                        onClick={() => toggleTask(index)}
                        className={`w-8 h-8 rounded border-2 flex items-center justify-center transition-colors cursor-pointer hover:scale-110 ${
                          task.completed
                            ? "bg-emerald-500 border-emerald-600"
                            : "bg-white border-stone-300 hover:border-stone-400"
                        }`}
                        aria-label={`Toggle ${task.day} task`}
                      >
                        {task.completed && (
                          <span className="text-white text-sm">✓</span>
                        )}
                      </button>
                      {/* Vertical line indicator */}
                      <div className="w-0.5 h-4 bg-stone-200"></div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* AM/PM Routine Tabs - Interactive Subpages */}
            <div className="md:col-span-2 lg:col-span-3 mt-6">
              <Card className="p-6">
                <Tabs value={activeRoutineTab} onValueChange={(value) => setActiveRoutineTab(value as "am" | "pm")}>
                  <TabsList className="grid w-full max-w-md grid-cols-2 gap-2 mb-6 bg-stone-100">
                    <TabsTrigger 
                      value="am" 
                      className="gap-2 border border-black data-[state=active]:bg-stone-900 data-[state=active]:text-white"
                    >
                      <Sun className="w-4 h-4" />
                      Morning
                    </TabsTrigger>
                    <TabsTrigger 
                      value="pm" 
                      className="gap-2 border border-black data-[state=active]:bg-stone-700 data-[state=active]:text-white"
                    >
                      <Moon className="w-4 h-4" />
                      Evening
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="am" className="space-y-4">
                    {amRoutine.map((step, index) => (
                      <Card key={step.step} className="p-6">
                        <div className="flex items-start gap-4">
                          <button
                            onClick={() => toggleRoutineStep("am", index)}
                            className={`flex-shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-colors cursor-pointer hover:scale-110 ${
                              routineCompletion.am[index]
                                ? "bg-emerald-500 border-emerald-600 text-white"
                                : "bg-stone-900 text-white border-stone-900 hover:bg-stone-700"
                            }`}
                            aria-label={`Toggle step ${step.step} completion`}
                          >
                            {routineCompletion.am[index] ? (
                              <span className="text-sm">✓</span>
                            ) : (
                              <span>{step.step}</span>
                            )}
                          </button>
                          <div className="flex-1">
                            <h4 className="font-medium text-stone-900 mb-2">
                              {step.productType}
                            </h4>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {step.actives.map((active) => (
                                <span
                                  key={active}
                                  className="px-2 py-1 text-xs font-medium bg-stone-100 text-stone-700 rounded-full"
                                >
                                  {active}
                                </span>
                              ))}
                            </div>
                            <p className="text-sm text-stone-600 leading-relaxed">
                              {step.rationale}
                            </p>
                            {step.alternatives.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-stone-200">
                                <p className="text-xs font-medium text-stone-500 mb-2">
                                  Alternatives:
                                </p>
                                <div className="space-y-1">
                                  {step.alternatives.map((alt, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between text-sm"
                                    >
                                      <span className="text-stone-700">
                                        {alt.brand} {alt.name}
                                      </span>
                                      <span className="font-medium text-stone-900">
                                        ${alt.price.toFixed(2)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="pm" className="space-y-4">
                    {pmRoutine.map((step, index) => (
                      <Card key={step.step} className="p-6">
                        <div className="flex items-start gap-4">
                          <button
                            onClick={() => toggleRoutineStep("pm", index)}
                            className={`flex-shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-colors cursor-pointer hover:scale-110 ${
                              routineCompletion.pm[index]
                                ? "bg-emerald-500 border-emerald-600 text-white"
                                : "bg-stone-900 text-white border-stone-900 hover:bg-stone-700"
                            }`}
                            aria-label={`Toggle step ${step.step} completion`}
                          >
                            {routineCompletion.pm[index] ? (
                              <span className="text-sm">✓</span>
                            ) : (
                              <span>{step.step}</span>
                            )}
                          </button>
                          <div className="flex-1">
                            <h4 className="font-medium text-stone-900 mb-2">
                              {step.productType}
                            </h4>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {step.actives.map((active) => (
                                <span
                                  key={active}
                                  className="px-2 py-1 text-xs font-medium bg-stone-100 text-stone-700 rounded-full"
                                >
                                  {active}
                                </span>
                              ))}
                            </div>
                            <p className="text-sm text-stone-600 leading-relaxed">
                              {step.rationale}
                            </p>
                            {step.alternatives.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-stone-200">
                                <p className="text-xs font-medium text-stone-500 mb-2">
                                  Alternatives:
                                </p>
                                <div className="space-y-1">
                                  {step.alternatives.map((alt, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between text-sm"
                                    >
                                      <span className="text-stone-700">
                                        {alt.brand} {alt.name}
                                      </span>
                                      <span className="font-medium text-stone-900">
                                        ${alt.price.toFixed(2)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </TabsContent>
                </Tabs>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
