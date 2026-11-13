// Dictation core: simulated SpeechRecognition sessions (pauses, auto-restarts, interim -> final, no duplicates).
// The live microphone can't run headless; these tests drive the same functions the hook calls on each browser event.
import { describe, it, expect } from "vitest";
import { initialState, applyResults, endSession, textOf, committedText, mergeNoDup, joinFinals } from "@/features/command/dictation";

const R = (...parts) => parts.map(([transcript, isFinal]) => ({ transcript, isFinal }));

describe("dictation", () => {
  it("shows interim words live and replaces them when they become final (no duplicates)", () => {
    let s = initialState();
    s = applyResults(s, R(["i work", false]));
    expect(textOf(s)).toBe("i work");
    expect(committedText(s)).toBe("");
    s = applyResults(s, R(["i work monday to friday", false]));
    expect(textOf(s)).toBe("i work monday to friday");
    s = applyResults(s, R(["i work monday to friday", true]));
    expect(textOf(s)).toBe("i work monday to friday");
    s = applyResults(s, R(["i work monday to friday", true], [" nine to six", false]));
    expect(textOf(s)).toBe("i work monday to friday nine to six");
    expect(s.interim).toBe("nine to six");
  });

  it("keeps everything across a pause: the browser ends the session, we restart, words are stitched once", () => {
    let s = initialState();
    s = applyResults(s, R(["we should use multiple sources", true]));
    s = endSession(s); // pause -> onend -> auto-restart
    expect(textOf(s)).toBe("we should use multiple sources");
    s = applyResults(s, R(["like eBay and TCG player", false])); // new session: results start from index 0 again
    expect(textOf(s)).toBe("we should use multiple sources like eBay and TCG player");
    s = applyResults(s, R(["like eBay and TCG player", true]));
    s = endSession(s);
    s = endSession(s); // a second onend with nothing new must not duplicate
    expect(textOf(s)).toBe("we should use multiple sources like eBay and TCG player");
  });

  it("commits interim words if a session dies before they finalise (network blip)", () => {
    let s = initialState();
    s = applyResults(s, R(["weekends", true], [" off", false]));
    s = endSession(s);
    expect(textOf(s)).toBe("weekends off");
    expect(s.interim).toBe("");
  });

  it("drops words a restarted session repeats from the end of the last one", () => {
    let s = initialState("gym and food happen from seven thirty");
    s = applyResults(s, R(["from seven thirty to nine", true]));
    s = endSession(s);
    expect(textOf(s)).toBe("gym and food happen from seven thirty to nine");
    expect(mergeNoDup("one two three", "two three")).toBe("one two three");
    expect(mergeNoDup("a b", "c d")).toBe("a b c d");
  });

  it("handles engines that resend the whole phrase as each final (Android)", () => {
    expect(joinFinals(["hello", "hello there", "hello there friend"])).toBe("hello there friend");
    let s = initialState();
    s = applyResults(s, R(["to do", true], ["to do a million", true], ["to do a million dollars in revenue", true]));
    expect(textOf(s)).toBe("to do a million dollars in revenue");
  });

  it("starts from typed text and appends what is said after it", () => {
    let s = initialState("My goal:");
    s = applyResults(s, R(["a million dollars", false]));
    expect(textOf(s)).toBe("My goal: a million dollars");
    s = endSession(applyResults(s, R(["a million dollars in 2027", true])));
    expect(textOf(s)).toBe("My goal: a million dollars in 2027");
  });

  it("accepts the browser's SpeechRecognitionResultList shape", () => {
    const list = [Object.assign([{ transcript: "hello" }], { isFinal: true }), Object.assign([{ transcript: "world" }], { isFinal: false })];
    const s = applyResults(initialState(), list);
    expect(textOf(s)).toBe("hello world");
  });
});
