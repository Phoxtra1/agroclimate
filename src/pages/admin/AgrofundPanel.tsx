import { useState, useMemo } from "react";
import { useAgrofund, AgrofundOpportunity, ApplicationTracker } from "@/hooks/useAgrofund";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Landmark, RefreshCw, Search, ExternalLink, CheckCircle2, XCircle,
  AlertTriangle, Clock, ShieldCheck, Bookmark, FileText, Globe, DollarSign,
  AlertCircle, Info, Edit3, Send, Archive, Copy, Check, Filter, Calendar, Sparkles
} from "lucide-react";

export default function AgrofundPanel() {
  const {
    opportunities,
    refreshLogs,
    notifications,
    trackers,
    bookmarksNotes,
    auditLogs,
    loading,
    refreshing,
    lastSuccessfulRefresh,
    nextScheduledRefresh,
    lastError,
    triggerDipaRefresh,
    updateOpportunityStatus,
    togglePublishOpportunity,
    updateOpportunity,
    updateApplicationStage,
    toggleBookmark,
    saveNote,
    markNotificationRead,
  } = useAgrofund();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [flagFilter, setFlagFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"deadline" | "amount" | "relevance" | "created">("deadline");

  // Dialog & Modal State
  const [editOpp, setEditOpp] = useState<AgrofundOpportunity | null>(null);
  const [editForm, setEditForm] = useState<Partial<AgrofundOpportunity>>({});
  const [noteModalOppId, setNoteModalOppId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [trackerModalOpp, setTrackerModalOpp] = useState<AgrofundOpportunity | null>(null);
  const [trackerStage, setTrackerStage] = useState<ApplicationTracker["stage"]>("not_applied");
  const [trackerNotes, setTrackerNotes] = useState("");
  const [trackerAssignee, setTrackerAssignee] = useState("");

  // Calculate Days Remaining helper
  const getDaysRemaining = (deadlineStr: string | null) => {
    if (!deadlineStr) return null;
    const diffTime = new Date(deadlineStr).getTime() - new Date().getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Metrics summary
  const totalCount = opportunities.length;
  const pendingCount = opportunities.filter((o) => o.status === "pending_review").length;
  const approvedCount = opportunities.filter((o) => o.status === "approved").length;
  const publishedCount = opportunities.filter((o) => o.is_published).length;
  const approachingCount = opportunities.filter((o) => {
    const days = getDaysRemaining(o.deadline);
    return days !== null && days >= 0 && days <= 7;
  }).length;

  const totalFundingUSD = opportunities.reduce((acc, o) => acc + (Number(o.funding_amount) || 0), 0);

  // Filtered & Sorted Opportunities
  const filteredOpportunities = useMemo(() => {
    return opportunities
      .filter((opp) => {
        // Search
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch =
          !searchTerm ||
          opp.title.toLowerCase().includes(searchLower) ||
          opp.organisation_name.toLowerCase().includes(searchLower) ||
          opp.category.toLowerCase().includes(searchLower) ||
          opp.eligibility_requirements.toLowerCase().includes(searchLower) ||
          opp.eligible_countries.some((c) => c.toLowerCase().includes(searchLower));

        // Status
        const matchesStatus = statusFilter === "all" || opp.status === statusFilter;

        // Category
        const matchesCategory = categoryFilter === "all" || opp.category === categoryFilter;

        // Country
        const matchesCountry =
          countryFilter === "all" ||
          opp.eligible_countries.some((c) => c.toLowerCase().includes(countryFilter.toLowerCase()));

        // Flag
        let matchesFlag = true;
        if (flagFilter === "approaching") {
          const days = getDaysRemaining(opp.deadline);
          matchesFlag = days !== null && days >= 0 && days <= 7;
        } else if (flagFilter === "expired") {
          const days = getDaysRemaining(opp.deadline);
          matchesFlag = opp.is_expired || (days !== null && days < 0);
        } else if (flagFilter === "unclear") {
          matchesFlag = opp.is_unclear_unverified;
        }

        return matchesSearch && matchesStatus && matchesCategory && matchesCountry && matchesFlag;
      })
      .sort((a, b) => {
        if (sortBy === "deadline") {
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        }
        if (sortBy === "amount") {
          return (b.funding_amount || 0) - (a.funding_amount || 0);
        }
        if (sortBy === "relevance") {
          return (b.relevance_score || 0) - (a.relevance_score || 0);
        }
        if (sortBy === "created") {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return 0;
      });
  }, [opportunities, searchTerm, statusFilter, categoryFilter, countryFilter, flagFilter, sortBy]);

  // Handle Edit Open
  const handleOpenEdit = (opp: AgrofundOpportunity) => {
    setEditOpp(opp);
    setEditForm({ ...opp });
  };

  // Handle Edit Save
  const handleSaveEdit = async () => {
    if (!editOpp) return;
    await updateOpportunity(editOpp.id, editForm);
    setEditOpp(null);
  };

  // Handle Note Save Open
  const handleOpenNote = (oppId: string) => {
    setNoteModalOppId(oppId);
    setNoteText(bookmarksNotes[oppId]?.note || "");
  };

  const handleSaveNoteSubmit = async () => {
    if (!noteModalOppId) return;
    await saveNote(noteModalOppId, noteText);
    setNoteModalOppId(null);
  };

  // Handle Application Tracker Open
  const handleOpenTracker = (opp: AgrofundOpportunity) => {
    setTrackerModalOpp(opp);
    const existing = trackers[opp.id];
    setTrackerStage(existing?.stage || "not_applied");
    setTrackerNotes(existing?.internal_notes || "");
    setTrackerAssignee(existing?.assigned_to || "");
  };

  const handleSaveTrackerSubmit = async () => {
    if (!trackerModalOpp) return;
    await updateApplicationStage(trackerModalOpp.id, trackerStage, trackerNotes, trackerAssignee);
    setTrackerModalOpp(null);
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Control */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card border rounded-xl p-5 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Landmark className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Agrofund</h1>
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
              <Sparkles className="h-3 w-3 mr-1" /> DIPA Discovered
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Discovered funding opportunities, grants, competitions, and climate finance curated in the background by DIPA intelligence.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 flex-wrap">
            <span>
              <strong>Last Refresh:</strong> {new Date(lastSuccessfulRefresh).toLocaleString()}
            </span>
            <span>·</span>
            <span>
              <strong>Next Scheduled:</strong> {new Date(nextScheduledRefresh).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span>·</span>
            {lastError ? (
              <span className="text-red-500 font-medium flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Refresh Warning
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> DIPA Engine Operational
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button
            onClick={triggerDipaRefresh}
            disabled={refreshing}
            className="gap-2 shadow"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Scanning Sources..." : "Fetch Opportunities with DIPA"}
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-card">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{totalCount}</p>
            <p className="text-xs text-muted-foreground">Total Discovered</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{pendingCount}</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">Pending Review</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/10 border-emerald-500/30">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{approvedCount}</p>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">{publishedCount} Published</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-500/10 border-purple-500/30">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{approachingCount}</p>
            <p className="text-xs text-purple-700 dark:text-purple-300 font-medium">Closing in &lt; 7 Days</p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">${totalFundingUSD.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Discovered Pipeline Value</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs defaultValue="opportunities" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto">
          <TabsTrigger value="opportunities" className="gap-2">
            <Landmark className="h-4 w-4" /> Opportunities Queue ({filteredOpportunities.length})
          </TabsTrigger>
          <TabsTrigger value="applications" className="gap-2">
            <FileText className="h-4 w-4" /> Application Trackers ({Object.keys(trackers).length})
          </TabsTrigger>
          <TabsTrigger value="bookmarks" className="gap-2">
            <Bookmark className="h-4 w-4" /> Bookmarks &amp; Notes
          </TabsTrigger>
          <TabsTrigger value="dipa-logs" className="gap-2">
            <ShieldCheck className="h-4 w-4" /> DIPA Engine &amp; Audit Logs
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: OPPORTUNITIES QUEUE */}
        <TabsContent value="opportunities" className="space-y-4 pt-4">
          {/* Search, Filter & Sort Toolbar */}
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
              <div className="lg:col-span-2 relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search title, organization, country, requirement..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div>
                <Label className="text-[11px] text-muted-foreground">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending_review">Pending Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="needs_verification">Needs Verification</SelectItem>
                    <SelectItem value="duplicate">Duplicate</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px] text-muted-foreground">Category</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="agri-tech">Agri-Tech</SelectItem>
                    <SelectItem value="agriculture">Agriculture</SelectItem>
                    <SelectItem value="climate_resilience">Climate Resilience</SelectItem>
                    <SelectItem value="sustainable_food_systems">Sustainable Food Systems</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px] text-muted-foreground">Urgency / Flags</Label>
                <Select value={flagFilter} onValueChange={setFlagFilter}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Opportunities</SelectItem>
                    <SelectItem value="approaching">Closing Soon (&lt;7 days)</SelectItem>
                    <SelectItem value="expired">Expired Deadlines</SelectItem>
                    <SelectItem value="unclear">Unclear / Unverified</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px] text-muted-foreground">Sort By</Label>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deadline">Deadline (Soonest)</SelectItem>
                    <SelectItem value="amount">Funding Amount (Highest)</SelectItem>
                    <SelectItem value="relevance">DIPA Match Score</SelectItem>
                    <SelectItem value="created">Discovery Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* List of Opportunities */}
          {loading ? (
            <Card className="p-8 text-center"><p className="text-muted-foreground">Loading Agrofund opportunities...</p></Card>
          ) : filteredOpportunities.length === 0 ? (
            <Card className="p-8 text-center space-y-3">
              <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="font-semibold text-lg">No funding opportunities match criteria.</p>
              <p className="text-sm text-muted-foreground">Try clearing filters or click "Fetch Opportunities with DIPA" to discover new grants.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredOpportunities.map((opp) => {
                const daysLeft = getDaysRemaining(opp.deadline);
                const isBookmarked = bookmarksNotes[opp.id]?.is_bookmarked;
                const tracker = trackers[opp.id];

                return (
                  <Card key={opp.id} className={`transition-all hover:border-primary/50 ${opp.status === "pending_review" ? "border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/10" : ""}`}>
                    <CardHeader className="pb-3">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="font-mono text-[11px] uppercase bg-muted">
                              {opp.category.replace("_", " ")}
                            </Badge>
                            <Badge className="bg-primary/20 text-primary border-primary/30">
                              <Sparkles className="h-3 w-3 mr-1" /> {opp.relevance_score}% DIPA Match
                            </Badge>

                            {/* Status Badges */}
                            {opp.status === "pending_review" && (
                              <Badge className="bg-amber-500 text-white font-semibold">Pending Review</Badge>
                            )}
                            {opp.status === "approved" && (
                              <Badge className="bg-emerald-600 text-white font-semibold">Approved</Badge>
                            )}
                            {opp.status === "rejected" && (
                              <Badge variant="destructive">Rejected</Badge>
                            )}
                            {opp.status === "needs_verification" && (
                              <Badge className="bg-purple-600 text-white">Needs Verification</Badge>
                            )}
                            {opp.status === "duplicate" && (
                              <Badge variant="outline" className="text-muted-foreground">Duplicate</Badge>
                            )}
                            {opp.status === "archived" && (
                              <Badge variant="outline" className="text-muted-foreground">Archived</Badge>
                            )}

                            {/* Published Badge */}
                            {opp.is_published ? (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live Published
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">Unpublished</Badge>
                            )}

                            {/* Unclear Info Flag */}
                            {opp.is_unclear_unverified && (
                              <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 gap-1">
                                <AlertTriangle className="h-3 w-3" /> Unclear Info Flagged
                              </Badge>
                            )}
                          </div>

                          <h2 className="text-xl font-bold text-foreground pt-1">{opp.title}</h2>
                          <p className="text-sm font-semibold text-primary/90 flex items-center gap-1.5">
                            <Globe className="h-4 w-4" /> {opp.organisation_name}
                          </p>
                        </div>

                        <div className="flex flex-col items-start md:items-end gap-1.5 shrink-0">
                          <div className="text-2xl font-extrabold text-foreground flex items-center gap-1">
                            <span>{opp.currency}</span>
                            <span>{Number(opp.funding_amount).toLocaleString()}</span>
                          </div>

                          {/* Days remaining pill */}
                          {daysLeft !== null && (
                            <div className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                              daysLeft < 0
                                ? "bg-red-500/10 text-red-600"
                                : daysLeft <= 7
                                ? "bg-purple-500/10 text-purple-600 animate-pulse"
                                : "bg-muted text-muted-foreground"
                            }`}>
                              <Clock className="h-3.5 w-3.5" />
                              {daysLeft < 0 ? "Expired" : `${daysLeft} days remaining`}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4 text-sm">
                      {/* Eligibility & Details Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 rounded-lg p-3 border">
                        <div>
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Eligible Countries</p>
                          <div className="flex flex-wrap gap-1">
                            {opp.eligible_countries.map((c, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Required Documents</p>
                          <div className="flex flex-wrap gap-1">
                            {opp.required_documents.map((d, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{d}</Badge>
                            ))}
                          </div>
                        </div>

                        <div className="md:col-span-2">
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Eligibility Criteria</p>
                          <p className="text-xs text-foreground leading-relaxed">{opp.eligibility_requirements}</p>
                        </div>
                      </div>

                      {/* DIPA Eligibility Rationale Callout */}
                      <Accordion type="single" collapsible className="w-full bg-primary/5 rounded-lg border border-primary/20 px-3 py-1">
                        <AccordionItem value="rationale" className="border-b-0">
                          <AccordionTrigger className="text-xs font-bold text-primary hover:no-underline py-2">
                            <span className="flex items-center gap-2">
                              <Sparkles className="h-3.5 w-3.5" /> DIPA Assessment: {opp.eligibility_assessment}
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-2 pt-1 text-xs">
                            <p className="text-foreground">{opp.eligibility_reasons}</p>
                            {opp.is_unclear_unverified && opp.unclear_details && (
                              <div className="bg-amber-500/10 border border-amber-500/30 rounded p-2 text-amber-800 dark:text-amber-200">
                                <strong>Flagged Unclear Information:</strong> {opp.unclear_details}
                              </div>
                            )}
                            <div className="pt-2 border-t border-primary/20 flex items-center justify-between text-[11px] text-muted-foreground flex-wrap gap-2">
                              <span><strong>Source Credibility:</strong> {opp.source_credibility_score}%</span>
                              <span><strong>Source Evidence:</strong> {opp.source_evidence_summary}</span>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>

                      {/* Official Link & Application Stage */}
                      <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
                        <a
                          href={opp.official_application_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                        >
                          Official Application Portal <ExternalLink className="h-3.5 w-3.5" />
                        </a>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-medium">Application Tracker:</span>
                          <Badge variant="outline" className="capitalize bg-card font-semibold">
                            {(tracker?.stage || "not_applied").replace("_", " ")}
                          </Badge>
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => handleOpenTracker(opp)}>
                            <Edit3 className="h-3 w-3" /> Update Tracker
                          </Button>
                        </div>
                      </div>

                      {/* ADMIN WORKFLOW CONTROLS TOOLBAR */}
                      <div className="pt-3 border-t flex flex-wrap items-center justify-between gap-2 bg-card p-3 rounded-lg">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Button
                            size="sm"
                            variant={opp.status === "approved" ? "default" : "outline"}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1"
                            onClick={() => updateOpportunityStatus(opp.id, "approved")}
                          >
                            <Check className="h-3.5 w-3.5" /> Approve
                          </Button>

                          <Button
                            size="sm"
                            variant={opp.status === "rejected" ? "default" : "outline"}
                            className="text-red-600 hover:bg-red-500/10 text-xs h-8 gap-1"
                            onClick={() => updateOpportunityStatus(opp.id, "rejected")}
                          >
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="text-purple-600 hover:bg-purple-500/10 text-xs h-8 gap-1"
                            onClick={() => updateOpportunityStatus(opp.id, "needs_verification")}
                          >
                            <AlertTriangle className="h-3.5 w-3.5" /> Verification Needed
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-8 gap-1"
                            onClick={() => handleOpenEdit(opp)}
                          >
                            <Edit3 className="h-3.5 w-3.5" /> Edit
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-8 gap-1 text-muted-foreground"
                            onClick={() => updateOpportunityStatus(opp.id, "duplicate")}
                          >
                            <Copy className="h-3.5 w-3.5" /> Duplicate
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-8 gap-1 text-muted-foreground"
                            onClick={() => updateOpportunityStatus(opp.id, "archived")}
                          >
                            <Archive className="h-3.5 w-3.5" /> Archive
                          </Button>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Publish Toggle Button */}
                          <div className="flex items-center gap-2 border-l pl-3">
                            <Label className="text-xs font-medium cursor-pointer">Live Published</Label>
                            <Switch
                              checked={opp.is_published}
                              onCheckedChange={() => togglePublishOpportunity(opp.id)}
                            />
                          </div>

                          {/* Bookmark button */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className={`h-8 w-8 ${isBookmarked ? "text-amber-500 fill-amber-500" : "text-muted-foreground"}`}
                            onClick={() => toggleBookmark(opp.id)}
                          >
                            <Bookmark className="h-4 w-4" />
                          </Button>

                          {/* Note button */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground"
                            onClick={() => handleOpenNote(opp.id)}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: APPLICATION TRACKERS */}
        <TabsContent value="applications" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> Application Lifecycle Tracking
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {opportunities.map((opp) => {
                const trk = trackers[opp.id];
                return (
                  <div key={opp.id} className="flex flex-col md:flex-row md:items-center justify-between border rounded-lg p-3 gap-3">
                    <div className="space-y-1">
                      <p className="font-bold text-foreground">{opp.title}</p>
                      <p className="text-xs text-muted-foreground">{opp.organisation_name} · {opp.currency} {Number(opp.funding_amount).toLocaleString()}</p>
                      {trk?.internal_notes && (
                        <p className="text-xs bg-muted/50 rounded p-1.5 text-foreground italic">"{trk.internal_notes}"</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <Select
                        value={trk?.stage || "not_applied"}
                        onValueChange={(val) => updateApplicationStage(opp.id, val as any, trk?.internal_notes || undefined, trk?.assigned_to || undefined)}
                      >
                        <SelectTrigger className="w-40 h-8 text-xs font-semibold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_applied">Not Applied</SelectItem>
                          <SelectItem value="preparing">Preparing Application</SelectItem>
                          <SelectItem value="submitted">Submitted</SelectItem>
                          <SelectItem value="shortlisted">Shortlisted</SelectItem>
                          <SelectItem value="awarded">Awarded 🎉</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleOpenTracker(opp)}>
                        Edit Notes
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: BOOKMARKS & NOTES */}
        <TabsContent value="bookmarks" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bookmark className="h-5 w-5 text-amber-500" /> Bookmarked Opportunities &amp; Admin Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {opportunities.filter((o) => bookmarksNotes[o.id]?.is_bookmarked || bookmarksNotes[o.id]?.note).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No bookmarked opportunities or saved notes yet.</p>
              ) : (
                opportunities.filter((o) => bookmarksNotes[o.id]?.is_bookmarked || bookmarksNotes[o.id]?.note).map((opp) => {
                  const bm = bookmarksNotes[opp.id];
                  return (
                    <div key={opp.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground">{opp.title}</span>
                        <Badge variant="outline">{opp.organisation_name}</Badge>
                      </div>

                      {bm?.note && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded p-2 text-xs text-amber-900 dark:text-amber-200">
                          <strong>Admin Note:</strong> {bm.note}
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleOpenNote(opp.id)}>
                          Edit Note
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500" onClick={() => toggleBookmark(opp.id)}>
                          Remove Bookmark
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: DIPA REFRESH EXECUTION & AUDIT LOGS */}
        <TabsContent value="dipa-logs" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Refresh Execution Logs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-primary" /> DIPA Refresh Execution History
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {refreshLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No refresh logs recorded.</p>
                ) : (
                  refreshLogs.slice(0, 10).map((log) => (
                    <div key={log.id} className="border rounded p-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="capitalize font-mono">{log.refresh_type}</Badge>
                        <span className="text-muted-foreground">{new Date(log.completed_at).toLocaleString()}</span>
                      </div>
                      <p>Found: <strong>{log.opportunities_found}</strong> · New: <strong>{log.new_inserted}</strong> · Updated: <strong>{log.records_updated}</strong></p>
                      {log.error_message && (
                        <p className="text-red-500 font-mono text-[11px]">{log.error_message}</p>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Notification Stream */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-primary" /> System Notification Dispatch
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {notifications.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No pending notifications.</p>
                ) : (
                  notifications.slice(0, 10).map((n) => (
                    <div key={n.id} className={`border rounded p-2.5 text-xs space-y-1 ${!n.read ? "bg-primary/5 border-primary/30" : ""}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{n.title}</span>
                        {!n.read && (
                          <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1 text-primary" onClick={() => markNotificationRead(n.id)}>
                            Mark Read
                          </Button>
                        )}
                      </div>
                      <p className="text-muted-foreground">{n.message}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Full Audit Log Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> Admin Review &amp; Decision Audit Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No audit logs recorded.</p>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="border-b py-2 text-xs flex items-center justify-between gap-2">
                      <div>
                        <Badge variant="outline" className="font-mono uppercase text-[10px] mr-2">{log.action}</Badge>
                        <span>{log.notes || "No notes"}</span>
                      </div>
                      <span className="text-muted-foreground shrink-0">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* EDIT OPPORTUNITY DIALOG */}
      <Dialog open={!!editOpp} onOpenChange={(open) => !open && setEditOpp(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Opportunity Details</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2 text-sm">
            <div className="col-span-2">
              <Label>Opportunity Title</Label>
              <Input value={editForm.title || ""} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>

            <div>
              <Label>Organisation Name</Label>
              <Input value={editForm.organisation_name || ""} onChange={(e) => setEditForm({ ...editForm, organisation_name: e.target.value })} />
            </div>

            <div>
              <Label>Category</Label>
              <Select value={editForm.category || "agriculture"} onValueChange={(val) => setEditForm({ ...editForm, category: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agri-tech">Agri-Tech</SelectItem>
                  <SelectItem value="agriculture">Agriculture</SelectItem>
                  <SelectItem value="climate_resilience">Climate Resilience</SelectItem>
                  <SelectItem value="sustainable_food_systems">Sustainable Food Systems</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Funding Amount</Label>
              <Input type="number" value={editForm.funding_amount || 0} onChange={(e) => setEditForm({ ...editForm, funding_amount: Number(e.target.value) })} />
            </div>

            <div>
              <Label>Currency</Label>
              <Input value={editForm.currency || "USD"} onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })} />
            </div>

            <div className="col-span-2">
              <Label>Eligible Countries (comma separated)</Label>
              <Input
                value={(editForm.eligible_countries || []).join(", ")}
                onChange={(e) => setEditForm({ ...editForm, eligible_countries: e.target.value.split(",").map((s) => s.trim()) })}
              />
            </div>

            <div className="col-span-2">
              <Label>Eligibility Requirements</Label>
              <Textarea
                rows={3}
                value={editForm.eligibility_requirements || ""}
                onChange={(e) => setEditForm({ ...editForm, eligibility_requirements: e.target.value })}
              />
            </div>

            <div className="col-span-2">
              <Label>Official Application Link</Label>
              <Input value={editForm.official_application_link || ""} onChange={(e) => setEditForm({ ...editForm, official_application_link: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpp(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SAVE NOTE DIALOG */}
      <Dialog open={!!noteModalOppId} onOpenChange={(open) => !open && setNoteModalOppId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Admin Internal Note</DialogTitle></DialogHeader>
          <Textarea
            placeholder="Type confidential admin notes..."
            rows={4}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteModalOppId(null)}>Cancel</Button>
            <Button onClick={handleSaveNoteSubmit}>Save Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* TRACKER EDIT DIALOG */}
      <Dialog open={!!trackerModalOpp} onOpenChange={(open) => !open && setTrackerModalOpp(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Application Tracker Stage</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Stage</Label>
              <Select value={trackerStage} onValueChange={(val) => setTrackerStage(val as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_applied">Not Applied</SelectItem>
                  <SelectItem value="preparing">Preparing Application</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="shortlisted">Shortlisted</SelectItem>
                  <SelectItem value="awarded">Awarded 🎉</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Assigned Team Lead</Label>
              <Input placeholder="e.g., Lead Grant Manager" value={trackerAssignee} onChange={(e) => setTrackerAssignee(e.target.value)} />
            </div>

            <div>
              <Label>Internal Tracker Notes</Label>
              <Textarea rows={3} placeholder="Notes on application status, requirements, or review feedback..." value={trackerNotes} onChange={(e) => setTrackerNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrackerModalOpp(null)}>Cancel</Button>
            <Button onClick={handleSaveTrackerSubmit}>Save Stage</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
