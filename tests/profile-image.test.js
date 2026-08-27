import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  MAX_PROFILE_IMAGE_BYTES,
  clampProfileCropOffset,
  getProfileCropSourceRect,
  validateProfileImageFile,
} from "../src/lib/profileImage.js";

test("validator foto profil menerima gambar hingga 20 MB", () => {
  const file = { type: "image/jpeg", size: MAX_PROFILE_IMAGE_BYTES };
  assert.equal(validateProfileImageFile(file), file);
});

test("validator foto profil menolak file non-gambar dan gambar terlalu besar", () => {
  assert.throws(
    () => validateProfileImageFile({ type: "application/pdf", size: 100 }),
    /harus berupa gambar/,
  );
  assert.throws(
    () =>
      validateProfileImageFile({
        type: "image/png",
        size: MAX_PROFILE_IMAGE_BYTES + 1,
      }),
    /maksimal 20 MB/,
  );
});

test("crop foto membatasi pergeseran agar lingkaran tidak memiliki area kosong", () => {
  assert.deepEqual(
    clampProfileCropOffset({
      imageWidth: 800,
      imageHeight: 400,
      viewportSize: 200,
      zoom: 1,
      offsetX: 150,
      offsetY: 50,
    }),
    { x: 100, y: 0 },
  );
});

test("crop foto tengah pada gambar lebar menghasilkan persegi dari tengah", () => {
  assert.deepEqual(
    getProfileCropSourceRect({
      imageWidth: 800,
      imageHeight: 400,
      viewportSize: 200,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    }),
    { x: 200, y: 0, size: 400 },
  );
});

test("Pengaturan membuka file picker dan editor crop interaktif", () => {
  const settings = readFileSync(
    new URL("../src/components/settings/SettingsPage.js", import.meta.url),
    "utf8",
  );

  assert.match(settings, /useRef/);
  assert.match(settings, /photoInputRef\.current\?\.click\(\)/);
  assert.match(settings, /readProfileImage/);
  assert.match(settings, /ProfilePhotoEditor/);
  assert.match(settings, /onPointerMove/);
  assert.match(settings, /type="range"/);
  assert.match(settings, /Gunakan foto/);
  assert.match(settings, /Foto siap disimpan\./);
});
