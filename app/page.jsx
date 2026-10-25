"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { products } from "./products";

const filters = ["All", "Market fresh", "Style", "Beauty", "Home", "Tech"];
const navigation = [
  ["All", "Discover"],
  ["Market fresh", "Market fresh"],
  ["Style", "Style"],
  ["Home", "Home & living"],
  ["Beauty", "Beauty"],
  ["Tech", "Tech"],
  ["Naija made", "Naija made"],
];
const money = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });

function formatNaira(amount) {
  return `₦${money.format(amount)}`;
}

export default function HomePage() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [aiProductIds, setAiProductIds] = useState(null);
  const [searchStatus, setSearchStatus] = useState("");
  const [searchError, setSearchError] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const [favorites, setFavorites] = useState(() => new Set());
  const [activeProduct, setActiveProduct] = useState(null);
  const [offer, setOffer] = useState("");
  const [offerError, setOfferError] = useState("");
  const [messages, setMessages] = useState([]);
  const [offerCount, setOfferCount] = useState(0);
  const [ended, setEnded] = useState(false);
  const [toast, setToast] = useState("");
  const searchRef = useRef(null);
  const offerRef = useRef(null);
  const messagesRef = useRef(null);
  const toastTimer = useRef(null);
  const searchRequestRef = useRef(0);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const searchProducts = aiProductIds
      ? aiProductIds
          .map((id) => products.find((product) => product.id === id))
          .filter(Boolean)
      : products;
    return searchProducts.filter((product) => {
      const matchesFilter =
        activeFilter === "All" ||
        product.category === activeFilter ||
        (activeFilter === "Style" && product.category === "Naija made");
      const matchesQuery =
        aiProductIds !== null ||
        `${product.name} ${product.seller} ${product.category}`
          .toLowerCase()
          .includes(query);
      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, aiProductIds, search]);

  function showToast(message) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2400);
  }

  function openNegotiation(product) {
    setActiveProduct(product);
    setOffer("");
    setOfferError("");
    setOfferCount(0);
    setEnded(false);
    setMessages([
      {
        sender: "agent",
        text: `Hey! ${product.seller} has this listed for ${formatNaira(product.price)}. Want to make an offer?`,
      },
    ]);
  }

  function closeNegotiation() {
    setActiveProduct(null);
  }

  function submitOffer(event) {
    event.preventDefault();
    if (!activeProduct || ended) return;

    const amountText = offer.trim().replace(/[₦,\s]/g, "");
    const amount = /^\d+$/.test(amountText) ? Number(amountText) : NaN;
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setOfferError("Enter a valid offer in naira.");
      offerRef.current?.focus();
      return;
    }

    const nextOfferCount = offerCount + 1;
    const floorPrice = Math.round(activeProduct.price * (1 - activeProduct.discount));
    const counterPrices = [
      Math.round(activeProduct.price - (activeProduct.price - floorPrice) * 0.5),
      Math.round(activeProduct.price - (activeProduct.price - floorPrice) * 0.8),
      floorPrice,
    ];
    const nextMessages = [...messages, { sender: "user", text: `My offer: ${formatNaira(amount)}` }];

    if (amount >= floorPrice) {
      nextMessages.push({
        sender: "agent",
        text: `Deal! ${formatNaira(amount)} works. That's a fair price. Your price is only locked in when you confirm an order — checkout isn't connected in this demo.`,
      });
      setEnded(true);
    } else if (nextOfferCount === 4) {
      nextMessages.push({
        sender: "agent",
        text: `I couldn't get us to a price that works this time. The seller's best available price is ${formatNaira(floorPrice)}. You can always come back another day.`,
      });
      setEnded(true);
    } else {
      const counter = counterPrices[nextOfferCount - 1];
      nextMessages.push({
        sender: "agent",
        text:
          nextOfferCount === 3
            ? `I've taken it to the seller's best price: ${formatNaira(counter)}. If that works for you, make an offer at or above it.`
            : `Thanks for the offer! The seller can do ${formatNaira(counter)}. What do you think?`,
      });
    }

    setOfferCount(nextOfferCount);
    setMessages(nextMessages);
    setOffer("");
    setOfferError("");
  }

  useEffect(() => {
    if (activeProduct) offerRef.current?.focus();
  }, [activeProduct]);

  useEffect(() => {
    if (activeProduct) messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight });
  }, [activeProduct, messages]);

  useEffect(() => {
    if (!activeProduct) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") setActiveProduct(null);
    }
    document.body.classList.add("modal-open");
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("modal-open");
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeProduct]);

  useEffect(() => {
    function handleSearchShortcut(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleSearchShortcut);
    return () => document.removeEventListener("keydown", handleSearchShortcut);
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(toastTimer.current);
    },
    [],
  );

  function selectFilter(filter) {
    searchRequestRef.current += 1;
    setAiProductIds(null);
    setSearchStatus("");
    setSearchError("");
    setActiveFilter(filter);
  }

  function resetFilters() {
    searchRequestRef.current += 1;
    setActiveFilter("All");
    setSearch("");
    setAiProductIds(null);
    setSearchStatus("");
    setSearchError("");
  }

  async function handleSearchSubmit(event) {
    event.preventDefault();
    document.querySelector("#products")?.scrollIntoView({ behavior: "smooth" });
    const query = search.trim();
    const requestId = ++searchRequestRef.current;
    setAiProductIds(null);
    setSearchError("");

    if (!query) {
      setSearchStatus("");
      return;
    }

    setSearchStatus("searching");
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, category: activeFilter }),
      });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.productIds)) {
        throw new Error(data.error || "AI search is unavailable.");
      }
      if (requestId !== searchRequestRef.current) return;
      setAiProductIds(data.productIds);
      setSearchStatus("ai");
    } catch (error) {
      if (requestId !== searchRequestRef.current) return;
      setAiProductIds(null);
      setSearchError(
        error instanceof Error ? error.message : "AI search failed.",
      );
      setSearchStatus("fallback");
    }
  }

  function toggleFavorite(product) {
    const next = new Set(favorites);
    const saved = !next.has(product.id);
    if (saved) next.add(product.id);
    else next.delete(product.id);
    setFavorites(next);
    showToast(saved ? "Saved to your favourites." : "Removed from your favourites.");
  }

  function subscribe(event) {
    event.preventDefault();
    showToast("You're on the list. Talk soon!");
    event.currentTarget.reset();
  }

  const remainingOffers = 4 - offerCount;

  return (
    <>
      <div className="announcement">
        <span>Good things are happening at your local market.</span>
        <a href="#products">Meet your new favourite sellers <span aria-hidden="true">↗</span></a>
      </div>

      <header className="site-header">
        <div className="header-main page-width">
          <a className="brand" href="#" aria-label="Oja home"><span className="brand-mark">o</span>oja<span className="brand-period">.</span></a>
          <form className="search" role="search" onSubmit={handleSearchSubmit}>
            <span className="icon" aria-hidden="true">⌕</span>
            <input
              ref={searchRef}
              type="search"
              placeholder="Try “gifts under ₦20,000”…"
              autoComplete="off"
              aria-label="Search products"
              value={search}
              onChange={(event) => {
                searchRequestRef.current += 1;
                setSearch(event.target.value);
                setAiProductIds(null);
                setSearchStatus("");
                setSearchError("");
              }}
            />
            <kbd>⌘ K</kbd>
            <button type="submit" disabled={searchStatus === "searching"}>
              {searchStatus === "searching" ? "Thinking…" : "Ask Oja"}
            </button>
          </form>

          <div className="header-actions">
            <button className="icon-button location-button" type="button" aria-label="Choose location" onClick={() => showToast("Oja is currently set to Lagos, Nigeria.")}>
              <span className="pin-icon" aria-hidden="true">⌖</span>
              <span><small>SHOPPING IN</small><strong>Lagos, Nigeria</strong></span>
              <span className="chevron" aria-hidden="true">⌄</span>
            </button>
            <button className="icon-button profile-button" type="button" aria-label="Account" onClick={() => showToast("Shop as a guest for now — accounts are coming soon.")}>
              <span className="outline-icon" aria-hidden="true">♙</span>
            </button>
            <button className="icon-button cart-button" type="button" aria-label="Shopping bag" onClick={() => showToast(cartCount ? `${cartCount} ${cartCount === 1 ? "item" : "items"} in your bag. Checkout is coming soon.` : "Your bag is waiting for a good find.")}>
              <span className="outline-icon" aria-hidden="true">▱</span>
              <span className="cart-count">{cartCount}</span>
            </button>
          </div>
        </div>

        <nav className="category-nav page-width" aria-label="Shop departments">
          {navigation.map(([filter, label]) => (
            <a
              className={activeFilter === filter ? "active" : ""}
              href="#products"
              key={filter}
              onClick={() => selectFilter(filter)}
            >
              {label}{filter === "Naija made" && <> <span className="new-tag">LOCAL</span></>}
            </a>
          ))}
          <a href="#sellers">Our sellers</a>
        </nav>
      </header>

      <main>
        <section className="hero page-width" aria-labelledby="hero-heading">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> YOUR MARKET, REIMAGINED</div>
            <h1 id="hero-heading">Good finds.<br /><span>Fair prices.</span></h1>
            <p>Shop the people behind the products. And yes, you can bargain — our friendly AI does the talking.</p>
            <a href="#products" className="button button-dark">Explore the market <span aria-hidden="true">↗</span></a>
            <div className="hero-proof">
              <div className="avatar-stack" aria-hidden="true"><i>👩🏾</i><i>👨🏿</i><i>👩🏿</i></div>
              <span>Loved by <strong>2,400+</strong> local shoppers</span>
            </div>
            <span className="hero-spark hero-spark-one" aria-hidden="true">✳</span>
          </div>
          <div className="hero-art">
            <Image src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=1400&auto=format&fit=crop&q=85" alt="Fresh produce at a local market" fill sizes="(max-width: 600px) 100vw, 55vw" priority />
            <div className="hero-image-shade" />
            <div className="hero-note"><span className="note-spark" aria-hidden="true">✳</span><span>Good finds,<br />closer to home.</span></div>
            <div className="seller-stamp"><span>MADE WITH</span><strong>Naija ♥</strong></div>
            <span className="hero-spark hero-spark-two" aria-hidden="true">✳</span>
          </div>
        </section>

        <section className="trust-row page-width" aria-label="Shopping benefits">
          <div><span className="trust-icon">✳</span><span><strong>Real local sellers</strong><small>Good people, good products</small></span></div>
          <div><span className="trust-icon">↗</span><span><strong>Prices you can talk about</strong><small>Let our agent do the bargaining</small></span></div>
          <div><span className="trust-icon">♡</span><span><strong>Pay with confidence</strong><small>Secure checkout, every time</small></span></div>
          <div><span className="trust-icon">⌂</span><span><strong>Made for your neighbourhood</strong><small>Shop close. Live well.</small></span></div>
        </section>

        <section className="market-section page-width" id="products">
          <div className="section-heading">
            <div>
              <div className="eyebrow">A LITTLE BIT OF EVERYTHING</div>
              <h2>Good things, <span>gathered.</span></h2>
              <p>Thoughtful picks from sellers worth knowing.</p>
            </div>
            <a className="text-link" href="#products">Shop all finds <span aria-hidden="true">↗</span></a>
          </div>
          <div className="filter-row" aria-label="Filter by category">
            {filters.map((filter) => (
              <button
                className={`filter-chip ${activeFilter === filter ? "selected" : ""}`}
                type="button"
                data-filter={filter}
                key={filter}
                onClick={() => selectFilter(filter)}
              >
                {filter === "All" ? <>All finds <span className="chip-count">08</span></> : filter === "Home" ? "Home & living" : filter}
              </button>
            ))}
          </div>
          {searchStatus && (
            <p className="search-assistant-status" role="status" aria-live="polite">
              {searchStatus === "searching"
                ? "Oja is understanding your search…"
                : searchStatus === "ai"
                  ? `Oja AI matched ${visibleProducts.length} ${visibleProducts.length === 1 ? "find" : "finds"} in the catalog.`
                  : `${searchError} Showing keyword matches instead.`}
            </p>
          )}
          <div className="product-grid" aria-live="polite">
            {visibleProducts.map((product) => {
              const saved = favorites.has(product.id);
              return (
                <article className="product-card" key={product.id}>
                  <div className="product-image-wrap">
                    <Image className="product-image" src={product.image} alt={product.name} fill sizes="(max-width: 600px) 50vw, (max-width: 900px) 33vw, 25vw" />
                    <span className="product-badge">{product.badge}</span>
                    <button className={`favorite-button ${saved ? "saved" : ""}`} type="button" aria-label={`${saved ? "Remove" : "Save"} ${product.name}`} aria-pressed={saved} onClick={() => toggleFavorite(product)}>{saved ? "♥" : "♡"}</button>
                  </div>
                  <div className="product-info">
                    <div className="seller-name">{product.seller}<span className="verified-mark" aria-label="Verified seller">✓</span></div>
                    <h3 title={product.name}>{product.name}</h3>
                    <div className="product-meta">
                      <div className="price-group"><span className="price">{formatNaira(product.price)}</span><span className="old-price">{formatNaira(product.compareAt)}</span></div>
                      <span className="rating"><span>★</span> {product.rating} ({product.reviews})</span>
                    </div>
                    <div className="product-actions">
                      <button className="bargain-button" type="button" onClick={() => openNegotiation(product)}>Bargain with Oja <span aria-hidden="true">↗</span></button>
                      <button className="add-button" type="button" aria-label={`Add ${product.name} to bag`} onClick={() => { setCartCount((count) => count + 1); showToast("Added to your bag. Nice find!"); }}>+</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {visibleProducts.length === 0 && (
            <div className="empty-state">
              <span aria-hidden="true">⌕</span>
              <h3>No finds just yet</h3>
              <p>Try a different search or category.</p>
              <button className="button button-dark" type="button" onClick={resetFilters}>See all finds</button>
            </div>
          )}
        </section>

        <section className="seller-banner page-width" id="sellers">
          <div className="seller-banner-copy">
            <div className="eyebrow">FOR THE PEOPLE WHO MAKE IT HAPPEN</div>
            <h2>Your hustle<br />deserves a <span>good market.</span></h2>
            <p>Bring your best to Oja. Meet new customers, set your own prices, and let your bargaining agent handle the back-and-forth.</p>
            <button className="button button-dark" type="button" onClick={() => showToast("Seller onboarding is coming soon. Tell us about your hustle at hello@oja.market.")}>Meet Oja for sellers <span aria-hidden="true">↗</span></button>
          </div>
          <div className="seller-banner-visual">
            <Image src="https://images.unsplash.com/photo-1579113800032-c38bd7635818?w=1000&auto=format&fit=crop&q=85" alt="Colourful fresh ingredients ready for market" fill sizes="(max-width: 600px) 100vw, 50vw" />
            <div className="seller-banner-label"><span>IN GOOD COMPANY</span><strong>Local is lovely.</strong></div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-main page-width">
          <div className="footer-brand">
            <a className="brand" href="#" aria-label="Oja home"><span className="brand-mark">o</span>oja<span className="brand-period">.</span></a>
            <p>A better way to shop your local market.</p>
          </div>
          <div className="footer-links"><strong>THE MARKET</strong><a href="#products">All finds</a><a href="#products" onClick={() => selectFilter("Naija made")}>Naija made</a><a href="#sellers">Sell with us</a></div>
          <div className="footer-links"><strong>HERE TO HELP</strong><a href="#products">How bargaining works</a><a href="#products">Shipping &amp; returns</a><a href="mailto:hello@oja.market">Get in touch</a></div>
          <div className="footer-newsletter">
            <strong>A GOOD NOTE, NOW &amp; THEN.</strong>
            <p>New finds and good news from the market.</p>
            <form onSubmit={subscribe}><input type="email" placeholder="Your email address" aria-label="Email address" required /><button type="submit" aria-label="Subscribe">↗</button></form>
          </div>
        </div>
        <div className="footer-bottom page-width"><span>© 2026 Oja Market. Made with ♥ in Nigeria.</span><span>Public image links via <a href="https://unsplash.com/license" target="_blank" rel="noreferrer">Unsplash</a>.</span></div>
      </footer>

      {activeProduct && (
        <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closeNegotiation(); }}>
          <section className="negotiation-modal" role="dialog" aria-modal="true" aria-labelledby="chat-title">
            <div className="chat-header">
              <button className="close-button" type="button" aria-label="Close chat" onClick={closeNegotiation}>×</button>
              <div className="chat-product-thumb" style={{ backgroundImage: `url("${activeProduct.image}")` }} />
              <div className="chat-title-wrap"><span className="agent-status"><i /> DEMO · OJA&apos;S BARGAINING AGENT</span><h2 id="chat-title">Let&apos;s find a fair price.</h2></div>
              <div className="chat-turns">{ended ? "Session ended" : `${remainingOffers} offer${remainingOffers === 1 ? "" : "s"} left`}</div>
            </div>
            <div className="chat-product-line">{activeProduct.name} · <strong>{formatNaira(activeProduct.price)}</strong> <span>· {activeProduct.seller}</span></div>
            <div className="chat-messages" aria-live="polite" ref={messagesRef}>
              {messages.map((message, index) => <div className={`message ${message.sender === "user" ? "user" : ""}`} key={`${index}-${message.sender}`}>{message.text}</div>)}
            </div>
            <div className="chat-footer">
              <p className="chat-disclaimer">Demo only: offer limits are simulated in your browser. Real prices must be checked by the server; only a confirmed order locks in your price.</p>
              <form className="offer-form" onSubmit={submitOffer}>
                <label className="sr-only" htmlFor="offer-input">Your offer in naira</label>
                <span className="naira-symbol">₦</span>
                <input ref={offerRef} id="offer-input" inputMode="numeric" autoComplete="off" placeholder="Enter your offer" aria-describedby="offer-hint" value={offer} onChange={(event) => { setOffer(event.target.value); setOfferError(""); }} disabled={ended} />
                <button type="submit" className="offer-button" disabled={ended}>Make an offer <span aria-hidden="true">↗</span></button>
              </form>
              <small id="offer-hint">{offerError || "Type an amount in naira to get started."}</small>
            </div>
          </section>
        </div>
      )}

      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </>
  );
}
