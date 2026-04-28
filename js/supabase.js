const supabaseUrl = "https://ivpvtjlhwhkoqewaqzdz.supabase.co";
const supabaseKey = "sb_publishable_T5j05ArkOEgka3EbMup6tQ_MM5m0uvR";

const db = window.supabase.createClient(supabaseUrl, supabaseKey);

console.log("Supabase connected ✅", db);