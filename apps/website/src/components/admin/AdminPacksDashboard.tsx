"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";
import { useCallback, useEffect, useState } from "react";

type QuizPackRow = {
  id: string;
  name: string;
  created_at: string;
};

type QuestionRow = {
  clientKey: string;
  dbId: string | null;
  questionNumber: number;
  questionText: string;
  hostNotes: string;
  answer: string;
};

type RoundRow = {
  clientKey: string;
  dbId: string | null;
  roundNumber: number;
  title: string;
  questions: QuestionRow[];
};

function newClientKey() {
  return crypto.randomUUID();
}

function defaultRoundTitle(roundNumber: number) {
  return roundNumber === 9 ? "Picture Round" : `Round ${roundNumber}`;
}

function parseCsv(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(cur);
      cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some((cell) => cell.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
    } else {
      cur += c;
    }
  }
  row.push(cur);
  if (row.some((cell) => cell.trim().length > 0)) {
    rows.push(row);
  }
  return rows;
}

function buildRoundsFromCsv(csvText: string): { rounds: RoundRow[]; error: string | null } {
  // Strip BOM and normalise line endings
  const raw = csvText.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!raw.trim()) {
    return { rounds: [], error: "Paste CSV content first." };
  }

  // Skip any preamble lines (e.g. markdown code fences, Claude commentary)
  // by finding the first line that looks like our header row.
  const lines = raw.split("\n");
  const headerIndex = lines.findIndex((l) => l.trim().toLowerCase().startsWith("round_number"));
  const cleaned = headerIndex >= 0 ? lines.slice(headerIndex).join("\n") : raw;

  // Auto-detect delimiter: if the header line has tabs but no commas, treat as TSV
  const firstLine = cleaned.trim().split("\n")[0] ?? "";
  const delimiter = firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : ",";

  let rows: string[][];
  try {
    rows = parseCsv(cleaned.trim(), delimiter);
  } catch {
    return { rounds: [], error: "Could not parse CSV." };
  }
  if (rows.length < 2) {
    return { rounds: [], error: "CSV needs a header row and at least one data row." };
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const expected = ["round_number", "round_title", "question_number", "question_text", "host_notes", "answer"];
  if (header.length < expected.length || !expected.every((e, i) => header[i] === e)) {
    return {
      rounds: [],
      error: `Header must be: ${expected.join(",")} — got: ${header.slice(0, 6).join(",")}`,
    };
  }

  type Accum = { title: string; questions: QuestionRow[] };
  const byRound = new Map<number, Accum>();

  for (let ri = 1; ri < rows.length; ri++) {
    const cols = rows[ri];
    if (cols.every((c) => !c.trim())) continue;
    if (cols.length < 6) {
      return { rounds: [], error: `Row ${ri + 1}: expected 6 columns, got ${cols.length}.` };
    }
    const roundNum = Number.parseInt(cols[0].trim(), 10);
    if (!Number.isFinite(roundNum) || roundNum < 1 || roundNum > 9) {
      return { rounds: [], error: `Row ${ri + 1}: round_number must be 1–9, got "${cols[0].trim()}".` };
    }
    const roundTitle = cols[1].trim();
    const qNum = Number.parseInt(cols[2].trim(), 10);
    if (!Number.isFinite(qNum) || qNum < 1 || qNum > 10) {
      return { rounds: [], error: `Row ${ri + 1}: question_number must be 1–10, got "${cols[2].trim()}".` };
    }
    const questionText = cols[3].trim();
    const hostNotes = cols[4].trim();
    const answer = cols[5].trim();

    let acc = byRound.get(roundNum);
    if (!acc) {
      acc = { title: roundTitle || defaultRoundTitle(roundNum), questions: [] };
      byRound.set(roundNum, acc);
    } else if (roundTitle && !acc.title) {
      acc.title = roundTitle;
    }

    acc.questions.push({
      clientKey: newClientKey(),
      dbId: null,
      questionNumber: qNum,
      questionText,
      hostNotes,
      answer,
    });
  }

  const rounds: RoundRow[] = Array.from(byRound.entries())
    .sort(([a], [b]) => a - b)
    .map(([roundNumber, acc]) => {
      acc.questions.sort((p, q) => p.questionNumber - q.questionNumber);
      return {
        clientKey: newClientKey(),
        dbId: null,
        roundNumber,
        title: acc.title || defaultRoundTitle(roundNumber),
        questions: acc.questions,
      };
    });

  if (rounds.length === 0) {
    return { rounds: [], error: "No valid data rows found." };
  }

  return { rounds, error: null };
}

function renumberQuestions(questions: QuestionRow[]): QuestionRow[] {
  return questions.map((q, i) => ({ ...q, questionNumber: i + 1 }));
}

const btnPrimary =
  "rounded-[12px] border-[3px] border-quizzer-black bg-quizzer-yellow px-3 py-1.5 text-xs font-semibold text-quizzer-black shadow-[4px_4px_0_#000] hover:shadow-[2px_2px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 disabled:pointer-events-none";
const btnSecondary =
  "rounded-[12px] border-[3px] border-quizzer-black bg-quizzer-white px-3 py-1.5 text-xs font-semibold text-quizzer-black shadow-[4px_4px_0_#000] hover:shadow-[2px_2px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50";
const btnDanger =
  "rounded-[12px] border-[3px] border-quizzer-black bg-red-600 px-2 py-1 text-xs font-semibold text-white shadow-[4px_4px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50";
const inputClass =
  "w-full rounded-[12px] border-[3px] border-quizzer-black border-solid bg-quizzer-white px-2 py-1.5 text-sm text-quizzer-black outline-none focus:ring-2 focus:ring-quizzer-yellow";

export function AdminPacksDashboard() {
  const [packs, setPacks] = useState<QuizPackRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [newPackOpen, setNewPackOpen] = useState(false);
  const [newPackName, setNewPackName] = useState("");
  const [newPackBusy, setNewPackBusy] = useState(false);

  const [editingPackId, setEditingPackId] = useState<string | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [packNameDraft, setPackNameDraft] = useState("");
  const [packNameSaved, setPackNameSaved] = useState("");
  const [nameEditing, setNameEditing] = useState(false);
  const [nameSaveBusy, setNameSaveBusy] = useState(false);

  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [expandedRound, setExpandedRound] = useState<Record<number, boolean>>({});

  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvError, setCsvError] = useState<string | null>(null);

  const [saveAllBusy, setSaveAllBusy] = useState(false);
  const [saveAllError, setSaveAllError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [deletePackBusy, setDeletePackBusy] = useState<string | null>(null);

  const loadPacks = useCallback(async () => {
    setListError(null);
    setListLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase
        .from("quiz_packs")
        .select("id, name, created_at")
        .order("created_at", { ascending: false });
      if (error) {
        captureSupabaseError("admin.quiz_packs_list", error);
        throw new Error(error.message);
      }
      setPacks((data ?? []) as QuizPackRow[]);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Could not load packs.");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPacks();
  }, [loadPacks]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  async function openEditor(packId: string) {
    setEditingPackId(packId);
    setEditorLoading(true);
    setEditorError(null);
    setCsvError(null);
    setSaveAllError(null);
    setImportOpen(false);
    setCsvText("");
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: packRow, error: pe } = await supabase
        .from("quiz_packs")
        .select("id, name")
        .eq("id", packId)
        .maybeSingle();
      if (pe || !packRow) throw new Error(pe?.message ?? "Pack not found.");
      setPackNameDraft(packRow.name);
      setPackNameSaved(packRow.name);

      const { data: roundRows, error: re } = await supabase
        .from("quiz_rounds")
        .select("id, round_number, title")
        .eq("quiz_pack_id", packId)
        .order("round_number", { ascending: true });
      if (re) throw new Error(re.message);
      const rlist = roundRows ?? [];
      const roundIds = rlist.map((r) => r.id);
      if (roundIds.length === 0) {
        setRounds([]);
        setExpandedRound({});
        return;
      }
      const { data: qRows, error: qe } = await supabase
        .from("quiz_questions")
        .select("id, quiz_round_id, question_number, question_text, host_notes")
        .in("quiz_round_id", roundIds)
        .order("question_number", { ascending: true });
      if (qe) throw new Error(qe.message);
      const questions = qRows ?? [];
      const qIds = questions.map((q) => q.id);
      let answerByQ = new Map<string, string>();
      if (qIds.length > 0) {
        const { data: aRows, error: ae } = await supabase
          .from("quiz_answers")
          .select("question_id, answer")
          .in("question_id", qIds);
        if (ae) throw new Error(ae.message);
        answerByQ = new Map((aRows ?? []).map((a) => [a.question_id, a.answer]));
      }

      const loadedRounds: RoundRow[] = rlist.map((r) => ({
        clientKey: newClientKey(),
        dbId: r.id,
        roundNumber: r.round_number,
        title: r.title,
        questions: questions
          .filter((q) => q.quiz_round_id === r.id)
          .map((q) => ({
            clientKey: newClientKey(),
            dbId: q.id,
            questionNumber: q.question_number,
            questionText: q.question_text ?? "",
            hostNotes: q.host_notes ?? "",
            answer: answerByQ.get(q.id) ?? "",
          })),
      }));
      setRounds(loadedRounds);
      const exp: Record<number, boolean> = {};
      loadedRounds.forEach((r, i) => {
        exp[r.roundNumber] = i === 0;
      });
      setExpandedRound(exp);
    } catch (e) {
      setEditorError(e instanceof Error ? e.message : "Could not load pack.");
      setRounds([]);
    } finally {
      setEditorLoading(false);
    }
  }

  function closeEditor() {
    setEditingPackId(null);
    setRounds([]);
    setPackNameDraft("");
    setPackNameSaved("");
    setEditorError(null);
    setSaveAllError(null);
    setCsvError(null);
    setImportOpen(false);
    setCsvText("");
  }

  async function createPack() {
    const name = newPackName.trim();
    if (!name) {
      setListError("Pack name is required.");
      return;
    }
    setNewPackBusy(true);
    setListError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.from("quiz_packs").insert({ name });
      if (error) {
        captureSupabaseError("admin.quiz_packs_insert", error);
        throw new Error(error.message);
      }
      setNewPackName("");
      setNewPackOpen(false);
      setToast("Pack created.");
      void loadPacks();
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Could not create pack.");
    } finally {
      setNewPackBusy(false);
    }
  }

  async function deletePack(row: QuizPackRow) {
    if (!window.confirm(`Delete pack "${row.name}" and all its rounds? This cannot be undone.`)) return;
    setDeletePackBusy(row.id);
    setListError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.from("quiz_packs").delete().eq("id", row.id);
      if (error) {
        captureSupabaseError("admin.quiz_packs_delete", error, { packId: row.id });
        throw new Error(error.message);
      }
      if (editingPackId === row.id) closeEditor();
      setToast("Pack deleted.");
      void loadPacks();
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Could not delete pack.");
    } finally {
      setDeletePackBusy(null);
    }
  }

  function applyCsvImport() {
    setCsvError(null);
    const { rounds: parsed, error } = buildRoundsFromCsv(csvText);
    if (error) {
      setCsvError(error);
      return;
    }
    setRounds(parsed);
    const exp: Record<number, boolean> = {};
    parsed.forEach((r, i) => {
      exp[r.roundNumber] = i === 0;
    });
    setExpandedRound(exp);
    setToast("CSV imported (preview). Save all to persist.");
  }

  function updateRoundTitle(roundNumber: number, title: string) {
    setRounds((prev) =>
      prev.map((r) => (r.roundNumber === roundNumber ? { ...r, title } : r)),
    );
  }

  function updateQuestion(
    roundNumber: number,
    clientKey: string,
    patch: Partial<Pick<QuestionRow, "questionText" | "hostNotes" | "answer">>,
  ) {
    setRounds((prev) =>
      prev.map((r) => {
        if (r.roundNumber !== roundNumber) return r;
        return {
          ...r,
          questions: r.questions.map((q) =>
            q.clientKey === clientKey ? { ...q, ...patch } : q,
          ),
        };
      }),
    );
  }

  function addQuestion(roundNumber: number) {
    setRounds((prev) =>
      prev.map((r) => {
        if (r.roundNumber !== roundNumber) return r;
        if (r.questions.length >= 10) return r;
        const next = [
          ...r.questions,
          {
            clientKey: newClientKey(),
            dbId: null,
            questionNumber: r.questions.length + 1,
            questionText: "",
            hostNotes: "",
            answer: "",
          },
        ];
        return { ...r, questions: renumberQuestions(next) };
      }),
    );
  }

  function deleteQuestion(roundNumber: number, clientKey: string) {
    setRounds((prev) =>
      prev.map((r) => {
        if (r.roundNumber !== roundNumber) return r;
        const filtered = r.questions.filter((q) => q.clientKey !== clientKey);
        return { ...r, questions: renumberQuestions(filtered) };
      }),
    );
  }

  async function savePackName() {
    if (!editingPackId || packNameDraft.trim() === packNameSaved) return;
    setNameSaveBusy(true);
    setEditorError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase
        .from("quiz_packs")
        .update({ name: packNameDraft.trim() })
        .eq("id", editingPackId);
      if (error) {
        captureSupabaseError("admin.quiz_packs_update", error, { packId: editingPackId });
        throw new Error(error.message);
      }
      setPackNameSaved(packNameDraft.trim());
      setToast("Pack name saved.");
      void loadPacks();
    } catch (e) {
      setEditorError(e instanceof Error ? e.message : "Could not save name.");
    } finally {
      setNameSaveBusy(false);
      setNameEditing(false);
    }
  }

  async function saveAllChanges() {
    if (!editingPackId) return;
    setSaveAllBusy(true);
    setSaveAllError(null);
    try {
      const supabase = createBrowserSupabaseClient();

      for (const round of rounds) {
        const title =
          round.title.trim() || defaultRoundTitle(round.roundNumber);
        for (const q of round.questions) {
          if (!q.questionText.trim()) {
            throw new Error(
              `Round ${round.roundNumber}: every question needs question text (Q${q.questionNumber}).`,
            );
          }
        }
      }

      const { data: existingRounds, error: er0 } = await supabase
        .from("quiz_rounds")
        .select("id")
        .eq("quiz_pack_id", editingPackId);
      if (er0) throw new Error(er0.message);
      const existingRoundIds = new Set((existingRounds ?? []).map((r) => r.id));

      const roundIdByNumber = new Map<number, string>();

      for (const round of rounds) {
        const title =
          round.title.trim() || defaultRoundTitle(round.roundNumber);
        if (round.dbId) {
          const { error: ue } = await supabase
            .from("quiz_rounds")
            .update({ title })
            .eq("id", round.dbId);
          if (ue) throw new Error(ue.message);
          roundIdByNumber.set(round.roundNumber, round.dbId);
        } else {
          const { data: ins, error: ie } = await supabase
            .from("quiz_rounds")
            .insert({
              quiz_pack_id: editingPackId,
              round_number: round.roundNumber,
              title,
            })
            .select("id")
            .single();
          if (ie) throw new Error(ie.message);
          roundIdByNumber.set(round.roundNumber, ins.id);
        }
      }

      const keptRoundIds = new Set(roundIdByNumber.values());
      for (const rid of existingRoundIds) {
        if (!keptRoundIds.has(rid)) {
          const { error: de } = await supabase.from("quiz_rounds").delete().eq("id", rid);
          if (de) throw new Error(de.message);
        }
      }

      const stateQuestionDbIds = new Set<string>();
      rounds.forEach((r) =>
        r.questions.forEach((q) => {
          if (q.dbId) stateQuestionDbIds.add(q.dbId);
        }),
      );

      const roundIdsForPack = Array.from(roundIdByNumber.values());
      if (roundIdsForPack.length > 0) {
        const { data: allQs, error: qe0 } = await supabase
          .from("quiz_questions")
          .select("id")
          .in("quiz_round_id", roundIdsForPack);
        if (qe0) throw new Error(qe0.message);
        for (const row of allQs ?? []) {
          if (!stateQuestionDbIds.has(row.id)) {
            const { error: dq } = await supabase.from("quiz_questions").delete().eq("id", row.id);
            if (dq) throw new Error(dq.message);
          }
        }
      }

      for (const round of rounds) {
        const roundId = roundIdByNumber.get(round.roundNumber);
        if (!roundId) continue;
        const qs = renumberQuestions(round.questions);
        for (let i = 0; i < qs.length; i++) {
          const q = qs[i];
          const qNum = i + 1;
          const qText = q.questionText.trim() || " ";
          const hNotes = q.hostNotes.trim() || null;
          const ans = q.answer.trim() || " ";

          if (q.dbId) {
            const { error: uq } = await supabase
              .from("quiz_questions")
              .update({
                question_number: qNum,
                question_text: qText,
                host_notes: hNotes,
              })
              .eq("id", q.dbId);
            if (uq) throw new Error(uq.message);
            const { error: ua } = await supabase.from("quiz_answers").upsert(
              { question_id: q.dbId, answer: ans },
              { onConflict: "question_id" },
            );
            if (ua) throw new Error(ua.message);
          } else {
            const { data: qIns, error: qi } = await supabase
              .from("quiz_questions")
              .insert({
                quiz_round_id: roundId,
                question_number: qNum,
                question_text: qText,
                host_notes: hNotes,
              })
              .select("id")
              .single();
            if (qi) throw new Error(qi.message);
            const { error: ai } = await supabase.from("quiz_answers").insert({
              question_id: qIns.id,
              answer: ans,
            });
            if (ai) throw new Error(ai.message);
          }
        }
      }

      setToast("All changes saved.");
      await openEditor(editingPackId);
      void loadPacks();
    } catch (e) {
      setSaveAllError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaveAllBusy(false);
    }
  }

  const [roundCounts, setRoundCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, number> = {};
      try {
        const supabase = createBrowserSupabaseClient();
        for (const p of packs) {
          const { count, error } = await supabase
            .from("quiz_rounds")
            .select("id", { count: "exact", head: true })
            .eq("quiz_pack_id", p.id);
          next[p.id] = error ? 0 : (count ?? 0);
          if (cancelled) return;
        }
      } catch {
        for (const p of packs) next[p.id] = 0;
      }
      if (!cancelled) setRoundCounts(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [packs]);

  if (editingPackId) {
    return (
      <div className="relative space-y-6 pb-24">
        {toast ? (
          <p
            className="fixed bottom-6 right-6 z-50 max-w-sm rounded-[12px] border-[3px] border-quizzer-black bg-quizzer-yellow px-4 py-2 text-sm font-semibold text-quizzer-black shadow-[5px_5px_0_#000]"
            role="status"
          >
            {toast}
          </p>
        ) : null}

        <button type="button" onClick={() => closeEditor()} className={btnSecondary}>
          ← Back to packs
        </button>

        {editorLoading ? (
          <p className="text-sm text-quizzer-black/70">Loading pack…</p>
        ) : (
          <>
            {editorError ? (
              <p className="rounded-[12px] border-[3px] border-red-600 bg-quizzer-white px-3 py-2 text-sm text-red-700">
                {editorError}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              {nameEditing ? (
                <input
                  type="text"
                  value={packNameDraft}
                  onChange={(e) => setPackNameDraft(e.target.value)}
                  onBlur={() => void savePackName()}
                  className={`${inputClass} font-heading text-2xl uppercase max-w-xl`}
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setNameEditing(true)}
                  className="font-heading text-left text-2xl uppercase text-quizzer-black border-b-2 border-dashed border-quizzer-black/30 hover:border-quizzer-black"
                >
                  {packNameDraft || "Pack name"}
                </button>
              )}
              {packNameDraft.trim() !== packNameSaved.trim() ? (
                <button
                  type="button"
                  disabled={nameSaveBusy}
                  onClick={() => void savePackName()}
                  className={btnPrimary}
                >
                  {nameSaveBusy ? "Saving…" : "Save pack name"}
                </button>
              ) : null}
            </div>

            <div className="rounded-[12px] border-[3px] border-quizzer-black bg-quizzer-white p-4 shadow-[5px_5px_0_#000]">
              <button
                type="button"
                onClick={() => setImportOpen((o) => !o)}
                className={btnSecondary}
              >
                {importOpen ? "Hide CSV import" : "Import from CSV"}
              </button>
              {importOpen ? (
                <div className="mt-4 space-y-2">
                  <textarea
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    rows={8}
                    placeholder="Paste CSV here…"
                    className={`${inputClass} font-mono text-xs`}
                  />
                  <p className="text-[10px] text-quizzer-black/60 leading-relaxed">
                    Expected columns: round_number, round_title, question_number, question_text, host_notes, answer
                    <br />
                    Example: 1,Science & Nature,1,What is the chemical symbol for gold?,Also written Au,Au
                  </p>
                  {csvError ? (
                    <p className="text-sm font-semibold text-red-600">{csvError}</p>
                  ) : null}
                  <button type="button" onClick={() => applyCsvImport()} className={btnPrimary}>
                    Import (preview)
                  </button>
                </div>
              ) : null}
            </div>

            {rounds.length === 0 ? (
              <p className="text-sm text-quizzer-black/70">
                No rounds yet. Use CSV import to add rounds and questions (preview), then Save all.
              </p>
            ) : (
              <div className="space-y-3">
                {rounds.map((round) => (
                  <div
                    key={round.clientKey}
                    className="rounded-[12px] border-[3px] border-quizzer-black bg-quizzer-white shadow-[5px_5px_0_#000] overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedRound((e) => ({
                          ...e,
                          [round.roundNumber]: !e[round.roundNumber],
                        }))
                      }
                      className="flex w-full items-center justify-between gap-2 bg-quizzer-cream px-4 py-3 text-left"
                    >
                      <span className="flex flex-1 flex-wrap items-center gap-2">
                        <span className="font-heading text-lg uppercase">
                          Round {round.roundNumber} —
                        </span>
                        <input
                          type="text"
                          value={round.title}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateRoundTitle(round.roundNumber, e.target.value)}
                          placeholder={defaultRoundTitle(round.roundNumber)}
                          className={`${inputClass} max-w-md font-semibold`}
                        />
                      </span>
                      <span className="text-quizzer-black text-xl" aria-hidden>
                        {expandedRound[round.roundNumber] ? "▼" : "▶"}
                      </span>
                    </button>
                    {expandedRound[round.roundNumber] ? (
                      <div className="overflow-x-auto p-4">
                        <table className="w-full border-collapse text-left text-sm">
                          <thead>
                            <tr className="border-b-2 border-quizzer-black/20">
                              <th className="px-2 py-2 font-semibold">Q#</th>
                              <th className="px-2 py-2 font-semibold">Question</th>
                              <th className="px-2 py-2 font-semibold">Host notes</th>
                              <th className="px-2 py-2 font-semibold">Answer</th>
                              <th className="px-2 py-2 font-semibold"> </th>
                            </tr>
                          </thead>
                          <tbody>
                            {round.questions.map((q) => (
                              <tr key={q.clientKey} className="border-b border-quizzer-black/10 align-top">
                                <td className="px-2 py-2 w-10 font-bold">{q.questionNumber}</td>
                                <td className="px-2 py-2 min-w-[180px]">
                                  <textarea
                                    value={q.questionText}
                                    onChange={(e) =>
                                      updateQuestion(round.roundNumber, q.clientKey, {
                                        questionText: e.target.value,
                                      })
                                    }
                                    rows={2}
                                    className={inputClass}
                                  />
                                </td>
                                <td className="px-2 py-2 min-w-[120px]">
                                  <textarea
                                    value={q.hostNotes}
                                    onChange={(e) =>
                                      updateQuestion(round.roundNumber, q.clientKey, {
                                        hostNotes: e.target.value,
                                      })
                                    }
                                    rows={2}
                                    className={inputClass}
                                  />
                                </td>
                                <td className="px-2 py-2 min-w-[100px]">
                                  <input
                                    type="text"
                                    value={q.answer}
                                    onChange={(e) =>
                                      updateQuestion(round.roundNumber, q.clientKey, {
                                        answer: e.target.value,
                                      })
                                    }
                                    className={inputClass}
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  <button
                                    type="button"
                                    onClick={() => deleteQuestion(round.roundNumber, q.clientKey)}
                                    className={btnDanger}
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <button
                          type="button"
                          disabled={round.questions.length >= 10}
                          onClick={() => addQuestion(round.roundNumber)}
                          className={`mt-3 ${btnSecondary}`}
                        >
                          Add question
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            {saveAllError ? (
              <p className="rounded-[12px] border-[3px] border-red-600 bg-quizzer-white px-3 py-2 text-sm font-semibold text-red-700">
                {saveAllError}
              </p>
            ) : null}

            <div className="fixed bottom-0 left-0 right-0 z-40 border-t-[3px] border-quizzer-black bg-quizzer-yellow px-4 py-3 shadow-[0_-4px_0_#000]">
              <div className="mx-auto flex max-w-7xl justify-end">
                <button
                  type="button"
                  disabled={saveAllBusy || rounds.length === 0}
                  onClick={() => void saveAllChanges()}
                  className={`${btnPrimary} px-6 py-3 text-base`}
                >
                  {saveAllBusy ? "Saving…" : "Save all changes"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative space-y-6">
      {toast ? (
        <p
          className="fixed bottom-6 right-6 z-50 max-w-sm rounded-[12px] border-[3px] border-quizzer-black bg-quizzer-yellow px-4 py-2 text-sm font-semibold text-quizzer-black shadow-[5px_5px_0_#000]"
          role="status"
        >
          {toast}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl uppercase text-quizzer-black">Quiz Packs</h1>
        <button
          type="button"
          onClick={() => {
            setNewPackOpen((o) => !o);
            setNewPackName("");
          }}
          className={btnPrimary}
        >
          {newPackOpen ? "Cancel" : "New Pack"}
        </button>
      </div>

      {listError ? (
        <p className="rounded-[12px] border-[3px] border-red-600 bg-quizzer-white px-3 py-2 text-sm text-red-700">
          {listError}
        </p>
      ) : null}

      {newPackOpen ? (
        <div className="rounded-[12px] border-[3px] border-quizzer-black bg-quizzer-white p-4 shadow-[5px_5px_0_#000] space-y-3 max-w-md">
          <label className="block text-xs font-semibold text-quizzer-black">
            Pack name
            <input
              type="text"
              value={newPackName}
              onChange={(e) => setNewPackName(e.target.value)}
              className={`mt-1 ${inputClass}`}
              placeholder="e.g. General Knowledge March 2026"
            />
          </label>
          <button
            type="button"
            disabled={newPackBusy}
            onClick={() => void createPack()}
            className={btnPrimary}
          >
            {newPackBusy ? "Saving…" : "Save"}
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-[12px] border-[3px] border-quizzer-black bg-quizzer-white shadow-[5px_5px_0_#000]">
        <table className="w-full border-collapse text-left text-sm text-quizzer-black">
          <thead>
            <tr className="border-b-2 border-quizzer-black/20 bg-quizzer-cream">
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Created</th>
              <th className="px-3 py-2 font-semibold">Rounds</th>
              <th className="px-3 py-2 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listLoading ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-quizzer-black/60">
                  Loading…
                </td>
              </tr>
            ) : packs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-quizzer-black/60">
                  No packs yet. Create one with New Pack.
                </td>
              </tr>
            ) : (
              packs.map((p) => (
                <tr key={p.id} className="border-b border-quizzer-black/10">
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2">
                    {new Date(p.created_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-3 py-2">{roundCounts[p.id] ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void openEditor(p.id)} className={btnPrimary}>
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={deletePackBusy === p.id}
                        onClick={() => void deletePack(p)}
                        className={btnDanger}
                      >
                        {deletePackBusy === p.id ? "…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
