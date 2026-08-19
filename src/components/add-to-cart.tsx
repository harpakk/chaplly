"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useCart } from "@/components/cart-context";
import { formatPrice, type Product } from "@/lib/catalog";
import { ResilientImage } from "@/components/resilient-image";

export function AddToCart({ product, redirectToCart = false }: { product: Product; redirectToCart?: boolean }) {
  const router = useRouter();
  const { addItem, items, updateQuantity } = useCart();
  const sellableVariants = useMemo(
    () => product.variants.filter((item) => item.inventory > 0),
    [product.variants],
  );
  const [color, setColor] = useState(sellableVariants[0]?.color || "");
  const availableSizes = useMemo(
    () =>
      sellableVariants
        .filter((item) => item.color === color)
        .map((item) => item.size),
    [color, sellableVariants],
  );
  const [size, setSize] = useState(
    sellableVariants.find((item) => item.color === color)?.size || "",
  );
  const [added, setAdded] = useState(false);
  const [cartPromptOpen, setCartPromptOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const variant = sellableVariants.find(
    (item) => item.color === color && item.size === size,
  );
  const cartItemIndex = variant
    ? items.findIndex((item) => item.variantId === variant.id)
    : -1;
  const cartItem = cartItemIndex >= 0 ? items[cartItemIndex] : undefined;
  const chooseColor = (next: string) => {
    setColor(next);
    const sizes = sellableVariants.filter((item) => item.color === next);
    if (!sizes.some((item) => item.size === size))
      setSize(sizes[0]?.size || "");
  };
  const add = () => {
    if (!variant) return;
    addItem({
      productId: product.id,
      variantId: variant.id,
      slug: product.slug,
      title: product.title,
      image: product.image,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      color,
      size,
      quantity: 1,
    });
    if (redirectToCart) {
      router.push("/cart");
      return;
    }
    setAdded(true);
    setCartPromptOpen(true);
    window.setTimeout(() => setAdded(false), 1800);
  };
  const colors = [
    ...new Map(sellableVariants.map((item) => [item.color, item])).values(),
  ];
  const sizes = [...new Set(sellableVariants.map((item) => item.size))];
  return (
    <div className="purchase-options">
      <fieldset>
        <legend>
          رنگ: <strong>{color}</strong>
        </legend>
        <div className="choice-row color-choice-row">
          {colors.map((option) => (
            <button
              className={color === option.color ? "selected" : ""}
              type="button"
              onClick={() => chooseColor(option.color)}
              key={option.color}
            >
              <i style={{ background: option.colorHex || "#ddd" }} />
              {option.color}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>
          اندازه: <strong>{size}</strong>
        </legend>
        <div className="choice-row">
          {sizes.map((option) => (
            <button
              className={size === option ? "selected" : ""}
              disabled={!availableSizes.includes(option)}
              type="button"
              onClick={() => setSize(option)}
              key={option}
            >
              {option}
            </button>
          ))}
        </div>
      </fieldset>
      {variant && (
        <>
          <div className="variant-price-live">
            <span>قیمت این تنوع</span>
            <b>{formatPrice(variant.price)}</b>
            {variant.compareAtPrice && (
              <del>{formatPrice(variant.compareAtPrice)}</del>
            )}
          </div>
          {variant.inventory > 0 && variant.inventory < 5 && (
            <p className="public-low-stock">
              فقط {variant.inventory.toLocaleString("fa-IR")} عدد باقی مانده
            </p>
          )}
        </>
      )}
      <div className="mobile-sticky-cart-action">
        {cartItem ? (
          <div className="pdp-quantity-control" aria-label="تعداد این تنوع در سبد خرید">
            <button type="button" onClick={() => updateQuantity(cartItemIndex, cartItem.quantity + 1)} aria-label="افزایش تعداد"><Plus /></button>
            <strong>{cartItem.quantity.toLocaleString("fa-IR")}</strong>
            <button type="button" onClick={() => updateQuantity(cartItemIndex, cartItem.quantity - 1)} aria-label={cartItem.quantity === 1 ? "حذف از سبد" : "کاهش تعداد"}><Minus /></button>
          </div>
        ) : (
          <button
            className={`buy-button ${added ? "added" : ""}`}
            disabled={!variant || variant.inventory < 1}
            type="button"
            onClick={add}
          >
            {added ? <><Check /> به سبد اضافه شد</> : <><ShoppingBag /> افزودن به سبد خرید</>}
          </button>
        )}
      </div>
      {mounted && cartPromptOpen && createPortal(
        <div
          className="cart-prompt-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setCartPromptOpen(false);
          }}
        >
          <section
            className="cart-prompt"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-prompt-title"
          >
            <button
              className="cart-prompt-close"
              type="button"
              aria-label="بستن"
              onClick={() => setCartPromptOpen(false)}
            >
              <X />
            </button>
            <span><Check /></span>
            <ResilientImage className="cart-prompt-image" src={product.image} alt={product.title} width={88} height={88} />
            <h2 id="cart-prompt-title">به سبد خرید اضافه شد</h2>
            <p>
              «{product.title}» با رنگ {color} و اندازه {size} در سبد توست.
            </p>
            <p className="cart-variant-reminder">🎨📐 لطفاً رنگ و اندازه را همین حالا دوباره بررسی کن تا دقیقاً انتخاب درستت ثبت شده باشد.</p>
            <div>
              <Link href="/cart" autoFocus>
                مشاهده سبد خرید <ArrowLeft />
              </Link>
              <button type="button" onClick={() => setCartPromptOpen(false)}>
                ادامه خرید
              </button>
            </div>
          </section>
        </div>, document.body
      )}
    </div>
  );
}
