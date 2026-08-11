"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toggleWishlistAction } from "@/app/actions/dashboard";

export function WishlistButton({ productId, title, initialLiked = false }: { productId: string; title: string; initialLiked?: boolean }) {
  const [liked, setLiked] = useState(initialLiked);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      className={`wishlist-button ${liked ? "active" : ""}`}
      aria-label={`${liked ? "حذف" : "افزودن"} ${title} ${liked ? "از" : "به"} علاقه‌مندی‌ها`}
      aria-pressed={liked}
      disabled={pending}
      onClick={() => {
        const next = !liked;
        setLiked(next);
        startTransition(async () => {
          const result = await toggleWishlistAction({ productId, active: next });
          if (!result.ok) {
            setLiked(!next);
            if (result.id === "AUTH_REQUIRED") router.push("/account/login");
          } else router.refresh();
        });
      }}
    >
      <Heart size={19} fill={liked ? "currentColor" : "none"} />
    </button>
  );
}
