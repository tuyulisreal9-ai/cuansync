export function getUserDisplayName(user) {
  return (
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Pengguna"
  );
}

export function getUserInitials(user) {
  const base = getUserDisplayName(user)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
  return base || "U";
}

export function getProfileDisplayName(profile, user) {
  return (
    profile?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Pengguna"
  );
}

export function getProfileEmail(profile, user) {
  return profile?.email || user?.email || "Demo Lokal";
}
