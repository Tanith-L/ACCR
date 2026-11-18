// deno test backend/supabase/functions/tests/
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";

import {
  buildModelMessages,
  citationsFor,
  keywordQuery,
  MAX_CHARS,
  parseChatBody,
  type Passage,
  scrubPersonal,
  speechText,
  ssml,
  urgencyOf,
  VOICES,
} from "../_shared/rheumy.ts";

const passage = (n: number, kind: "lesson" | "source" = "lesson"): Passage => ({
  id: `psa-dx-0${n}#1`, kind, source_id: `psa-dx-0${n}`, title: `Lesson ${n}`, locator: "Page 1",
  lesson_status: "checked", content: `Content ${n}`, score: 0.1,
});

Deno.test("parseChatBody keeps the latest turns and requires a final user question", () => {
  const ok = parseChatBody({ messages: [{ role: "user", content: "  What is PsA? " }] });
  assertEquals(ok, { messages: [{ role: "user", content: "What is PsA?" }] });
  assert("error" in parseChatBody({ messages: [] }));
  assert("error" in parseChatBody({ messages: [{ role: "system", content: "x" }] }));
  assert("error" in parseChatBody({ messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }] }));
  assert("error" in parseChatBody({ messages: [{ role: "user", content: "x".repeat(MAX_CHARS + 1) }] }));
  const many = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
  many.push({ role: "user", content: "last" });
  const parsed = parseChatBody({ messages: many });
  assert(!("error" in parsed) && parsed.messages.length === 8 && parsed.messages[7].content === "last");
});

Deno.test("scrubPersonal removes contact details, IDs and dates but keeps the question", () => {
  const out = scrubPersonal("I'm jane.doe@example.com, 412-555-0199, MRN 12345678, born 03/14/1980. My knee hurts.");
  assertEquals(out.includes("jane.doe"), false);
  assertEquals(out.includes("555"), false);
  assertEquals(out.includes("12345678"), false);
  assertEquals(out.includes("1980"), false);
  assertStringIncludes(out, "My knee hurts.");
  assertEquals(scrubPersonal("Is a 30 minute walk OK?"), "Is a 30 minute walk OK?");
});

Deno.test("urgencyOf flags emergencies and same-day symptoms, not ordinary questions", () => {
  assertEquals(urgencyOf("I have chest pain and can't breathe"), "emergency");
  assertEquals(urgencyOf("I suddenly lost my vision in one eye"), "emergency");
  assertEquals(urgencyOf("I've been thinking about suicide"), "emergency");
  assertEquals(urgencyOf("My eye is red and painful since this morning"), "urgent");
  assertEquals(urgencyOf("I have a fever and a hot swollen joint"), "urgent");
  assertEquals(urgencyOf("What is enthesitis?"), null);
  assertEquals(urgencyOf("How can I sleep better with PsA?"), null);
});

Deno.test("keywordQuery builds a safe OR query without stop words or symbols", () => {
  assertEquals(keywordQuery("Why does my HEEL hurt when I walk?"), "heel | hurt | walk");
  assertEquals(keywordQuery("'; drop table x; --"), "drop | table");
  assertEquals(keywordQuery("a b c"), "");
});

Deno.test("buildModelMessages puts numbered passages with the latest question", () => {
  const msgs = buildModelMessages(
    [{ role: "user", content: "first" }, { role: "assistant", content: "reply" }, { role: "user", content: "What is PsA?" }],
    [passage(1), passage(2, "source")],
  );
  assertEquals(msgs[0].role, "system");
  assertEquals(msgs.length, 4);
  assertStringIncludes(msgs[3].content, '[1] RheumNotes lesson: "Lesson 1" (Page 1)');
  assertStringIncludes(msgs[3].content, "[2] Source document for clinicians");
  assertStringIncludes(msgs[3].content, "Question: What is PsA?");
  assertStringIncludes(buildModelMessages([{ role: "user", content: "x" }], [])[1].content, "No passages matched");
});

Deno.test("citationsFor returns only the passages the answer cites, in order", () => {
  const cites = citationsFor("PsA affects joints [2]. Skin too [1][2]. Bogus [9].", [passage(1), passage(2)]);
  assertEquals(cites.map((c) => c.n), [1, 2]);
  assertEquals(cites[1].sourceId, "psa-dx-02");
});

Deno.test("five voices: three Azure, two Kokoro", () => {
  assertEquals(Object.keys(VOICES), ["ava", "jenny", "emma", "heart", "bella"]);
  assertEquals(Object.values(VOICES).map((v) => v.engine), ["azure", "azure", "azure", "kokoro", "kokoro"]);
});

Deno.test("speechText and ssml prepare safe text for Azure", () => {
  assertEquals(speechText("PsA can affect **skin** [1] and nails [2]."), "P S A can affect skin and nails.");
  const doc = ssml(`Tom & Jerry <say> "hi"`, "en-US-JennyNeural");
  assertStringIncludes(doc, 'voice name="en-US-JennyNeural"');
  assertStringIncludes(doc, "Tom &amp; Jerry &lt;say&gt; &quot;hi&quot;");
});
