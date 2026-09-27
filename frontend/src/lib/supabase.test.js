import { createClient } from "@supabase/supabase-js";
jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn() }));

const originalUrl = process.env.REACT_APP_SUPABASE_URL;
const originalKey = process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY;
let warning;
const load = () => {
  let module;
  jest.isolateModules(() => { module = require("./supabase"); });
  return module;
};
beforeEach(() => {
  createClient.mockReset();
  warning = jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  warning.mockRestore();
  if (originalUrl === undefined) delete process.env.REACT_APP_SUPABASE_URL;
  else process.env.REACT_APP_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY;
  else process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY = originalKey;
});

test.each([[undefined, "test-public-key"], ["https://example.supabase.co", undefined], ["https://example.supabase.co", "   "]])(
  "missing configuration fails closed without logging either value", (url, key) => {
    if (url === undefined) delete process.env.REACT_APP_SUPABASE_URL;
    else process.env.REACT_APP_SUPABASE_URL = url;
    if (key === undefined) delete process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY;
    else process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY = key;
    const module = load();
    expect(module.isSupabaseConfigured).toBe(false);
    expect(warning.mock.calls).toEqual([["Supabase not configured"]]);
    expect(() => module.getSupabase()).toThrow("Supabase not configured");
    expect(createClient).not.toHaveBeenCalled();
  }
);

test("uses the exact CRA variables for a singleton client and keyed SDK OAuth", async () => {
  process.env.REACT_APP_SUPABASE_URL = " https://example.supabase.co ";
  process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY = " test-public-key ";
  const signInWithOAuth = jest.fn().mockResolvedValue({ error: null });
  const client = { auth: { signInWithOAuth } };
  createClient.mockReturnValue(client);
  const module = load();
  expect(module.getSupabase()).toBe(client);
  expect(module.getSupabase()).toBe(client);
  expect(createClient).toHaveBeenCalledTimes(1);
  expect(createClient).toHaveBeenCalledWith("https://example.supabase.co", "test-public-key", expect.any(Object));
  expect(warning).not.toHaveBeenCalled();
  await module.signInWithGoogle();
  expect(signInWithOAuth).toHaveBeenCalledWith({
    provider: "google", options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: { apikey: "test-public-key" },
    },
  });
});
