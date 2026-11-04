/**
 * Shrinks a Meshy export into the site's guide model.
 *
 * Keeps the skeleton and animation clips of a rigged (Mixamo) export too. A raw Meshy GLB is two million triangles and tens of megabytes; this takes
 * it to ~45k triangles, 2K/1K WebP textures and meshopt compression (about
 * 1.7 MB), which the guide loads with GLTFLoader + MeshoptDecoder.
 *
 *   npm i --no-save @gltf-transform/core @gltf-transform/extensions \
 *     @gltf-transform/functions meshoptimizer sharp
 *   node scripts/optimize-guide.mjs path/to/meshy.glb public/models/guide/guide.glb 45000
 *
 * The tools are not dependencies of the site; they are only needed to run this.
 * Keep the original export out of the repository.
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { weld, simplify, textureCompress, meshopt, quantize, dedup, prune } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const [, , input, output, tris = "45000"] = process.argv;
await MeshoptEncoder.ready; await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder,
});
const doc = await io.read(input);
const count = () => doc.getRoot().listMeshes().flatMap(m => m.listPrimitives()).reduce((n, p) => n + (p.getIndices()?.getCount() ?? 0) / 3, 0);
const before = count();
await doc.transform(weld({ tolerance: 0.00001 }));
const target = Number(tris);
await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: target / count(), error: 0.02, lockBorder: false }));
console.log("triangles", before, "->", count());
await doc.transform(
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [2048, 2048], slots: /baseColor/, quality: 84 }),
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 1024], slots: /(metallicRoughness|normal)/, quality: 82 }),
  dedup(), prune(), quantize({ quantizePosition: 16, quantizeNormal: 10, quantizeTexcoord: 14 }),
  meshopt({ encoder: MeshoptEncoder, level: "high" }),
);
await io.write(output, doc);
