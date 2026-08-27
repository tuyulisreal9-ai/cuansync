export const MAX_PROFILE_IMAGE_BYTES = 20 * 1024 * 1024;
export const PROFILE_IMAGE_SIZE = 320;

export function validateProfileImageFile(file) {
  if (!file) throw new Error("Pilih file gambar terlebih dahulu.");
  if (!String(file.type || "").startsWith("image/")) {
    throw new Error("File yang dipilih harus berupa gambar.");
  }
  if (Number(file.size || 0) > MAX_PROFILE_IMAGE_BYTES) {
    throw new Error("Ukuran foto maksimal 20 MB.");
  }
  return file;
}

function loadImageSource(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onerror = () => reject(new Error("Format gambar tidak dapat dibaca."));
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error("Ukuran gambar tidak valid."));
        return;
      }
      resolve(image);
    };
    image.src = String(src || "");
  });
}

export async function readProfileImage(file) {
  validateProfileImageFile(file);

  const src = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
  const image = await loadImageSource(src);
  return {
    src,
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
}

function getCropMetrics({ imageWidth, imageHeight, viewportSize, zoom = 1 }) {
  const width = Math.max(1, Number(imageWidth) || 1);
  const height = Math.max(1, Number(imageHeight) || 1);
  const viewport = Math.max(1, Number(viewportSize) || 1);
  const normalizedZoom = Math.min(3, Math.max(1, Number(zoom) || 1));
  const scale = Math.max(viewport / width, viewport / height) * normalizedZoom;
  const displayWidth = width * scale;
  const displayHeight = height * scale;

  return {
    viewport,
    zoom: normalizedZoom,
    scale,
    displayWidth,
    displayHeight,
    maxOffsetX: Math.max(0, (displayWidth - viewport) / 2),
    maxOffsetY: Math.max(0, (displayHeight - viewport) / 2),
  };
}

export function clampProfileCropOffset({
  imageWidth,
  imageHeight,
  viewportSize,
  zoom = 1,
  offsetX = 0,
  offsetY = 0,
}) {
  const metrics = getCropMetrics({
    imageWidth,
    imageHeight,
    viewportSize,
    zoom,
  });
  return {
    x: Math.min(metrics.maxOffsetX, Math.max(-metrics.maxOffsetX, Number(offsetX) || 0)),
    y: Math.min(metrics.maxOffsetY, Math.max(-metrics.maxOffsetY, Number(offsetY) || 0)),
  };
}

export function getProfileCropSourceRect({
  imageWidth,
  imageHeight,
  viewportSize,
  zoom = 1,
  offsetX = 0,
  offsetY = 0,
}) {
  const metrics = getCropMetrics({
    imageWidth,
    imageHeight,
    viewportSize,
    zoom,
  });
  const offset = clampProfileCropOffset({
    imageWidth,
    imageHeight,
    viewportSize,
    zoom: metrics.zoom,
    offsetX,
    offsetY,
  });
  const sourceSize = metrics.viewport / metrics.scale;
  const sourceX =
    (metrics.displayWidth / 2 - metrics.viewport / 2 - offset.x) /
    metrics.scale;
  const sourceY =
    (metrics.displayHeight / 2 - metrics.viewport / 2 - offset.y) /
    metrics.scale;

  return {
    x: Math.max(0, Math.min(Number(imageWidth) - sourceSize, sourceX)),
    y: Math.max(0, Math.min(Number(imageHeight) - sourceSize, sourceY)),
    size: sourceSize,
  };
}

export async function cropProfileImage(
  photo,
  { viewportSize, zoom = 1, offsetX = 0, offsetY = 0 },
) {
  const image = await loadImageSource(photo?.src);
  const rect = getProfileCropSourceRect({
    imageWidth: photo?.width || image.naturalWidth,
    imageHeight: photo?.height || image.naturalHeight,
    viewportSize,
    zoom,
    offsetX,
    offsetY,
  });
  const canvas = document.createElement("canvas");
  canvas.width = PROFILE_IMAGE_SIZE;
  canvas.height = PROFILE_IMAGE_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Perangkat tidak mendukung pemrosesan foto.");

  context.fillStyle = "#0f172a";
  context.fillRect(0, 0, PROFILE_IMAGE_SIZE, PROFILE_IMAGE_SIZE);
  context.drawImage(
    image,
    rect.x,
    rect.y,
    rect.size,
    rect.size,
    0,
    0,
    PROFILE_IMAGE_SIZE,
    PROFILE_IMAGE_SIZE,
  );
  return canvas.toDataURL("image/jpeg", 0.84);
}

export async function resizeProfileImage(file) {
  const photo = await readProfileImage(file);
  return cropProfileImage(photo, {
    viewportSize: PROFILE_IMAGE_SIZE,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  });
}
