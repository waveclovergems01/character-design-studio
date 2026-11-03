import assert from 'node:assert/strict';
import { createServer } from 'vite';

let server;
try {
  server = await createServer({
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  await server.listen();

  const address = server.httpServer.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const [home, template, image] = await Promise.all([
    fetch(`${origin}/`),
    fetch(`${origin}/templates/AI_CHARACTER_MAPPING_TEMPLATE.md`),
    fetch(`${origin}/examples/novice_female_front.png`),
  ]);
  assert.equal(home.status, 200);
  assert.equal(template.status, 200);
  assert.equal(image.status, 200);
  assert.match(await home.text(), /Character Design Studio/i);
  assert.match(await template.text(), /```character-map/);
  assert.match(image.headers.get('content-type') ?? '', /image\/png/);

  const { demoMap } = await server.ssrLoadModule('/src/data/demo.ts');
  const { validateMap, parseCharacterMarkdown, toCharacterMarkdown } = await server.ssrLoadModule('/src/lib/character-map.ts');
  const { makeEditRequest, makeEditPrompt } = await server.ssrLoadModule('/src/lib/ai-prompts.ts');

  assert.equal(validateMap(demoMap).parts.length, 19);
  const parsed = parseCharacterMarkdown(toCharacterMarkdown(demoMap));
  assert.equal(parsed.parts.length, demoMap.parts.length);
  assert.equal(parsed.image.width, 1024);
  assert.equal(parsed.coordinate_system, 'normalized_1000');

  const bothBoots = parsed.parts.filter(p => p.pair_key === 'boots').map(p => p.id);
  assert.equal(bothBoots.length, 2);
  const request = makeEditRequest(parsed, bothBoots, 'REPLACE_ITEM', 'เปลี่ยนเป็นรองเท้าคริสตัล', true);
  assert.equal(request.selected_part_ids.length, 2);
  assert.equal(request.protected_part_ids.length, 17);
  assert.equal(request.target_regions.length, 2);
  const prompt = makeEditPrompt(parsed, request);
  assert.match(prompt, /รองเท้าคริสตัล/);
  assert.match(prompt, /same/i);
  assert.match(prompt, /character_left/);

  assert.throws(() => parseCharacterMarkdown('# Ordinary MD without coordinates'), /character-map/);
  const invalid = structuredClone(demoMap);
  invalid.parts[0].colors[0].hex = 'not-a-hex';
  assert.throws(() => validateMap(invalid), /HEX/);

  console.log('✓ Dev server serves app, Template and example PNG');
  console.log('✓ 19 sample parts validate and MD roundtrip succeeds');
  console.log('✓ Both-boot edit request protects the other 17 parts');
  console.log('✓ Invalid MD and color codes produce validation errors');
} finally {
  await server?.close();
}
