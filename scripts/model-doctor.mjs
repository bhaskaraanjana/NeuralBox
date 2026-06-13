// Model doctor — confirm every model in the central catalog still resolves
// anonymously on the Hugging Face Hub (catches gated / renamed / removed
// repos before users hit a runtime 404). Run: npm run doctor
import { allModels } from '../src/studio/models.js';

const models = allModels();
const seen = new Set();
const unique = models.filter((m) => m.model && !seen.has(m.model) && seen.add(m.model));

console.log(`Checking ${unique.length} unique model repos on huggingface.co…\n`);

async function check(id) {
    try {
        const r = await fetch(`https://huggingface.co/api/models/${id}`, { method: 'GET' });
        return { id, ok: r.ok, status: r.status };
    } catch (e) {
        return { id, ok: false, status: 'network: ' + (e.message || e) };
    }
}

const results = [];
// Small concurrency to be polite.
for (let i = 0; i < unique.length; i += 6) {
    const batch = unique.slice(i, i + 6);
    results.push(...await Promise.all(batch.map((m) => check(m.model))));
}

const bad = results.filter((r) => !r.ok);
for (const r of results.sort((a, b) => Number(a.ok) - Number(b.ok))) {
    console.log(`${r.ok ? '✅' : '❌'}  ${String(r.status).padEnd(6)} ${r.id}`);
}

if (bad.length) {
    console.error(`\n❌ ${bad.length} model(s) did not resolve: ${bad.map((b) => b.id).join(', ')}`);
    process.exit(1);
}
console.log(`\n✅ All ${unique.length} catalog models resolve.`);
