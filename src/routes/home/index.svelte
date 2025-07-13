<script>
  import { goto } from "@roxi/routify";
  $goto;
  import {
    HeartSolid,
    BellSolid,
    UserSolid,
    EyeSolid,
    GlobeSolid,
    EditSolid,
    MessageCaptionSolid,
    MessagesOutline,
  } from "flowbite-svelte-icons";
  import { _ } from "@/i18n";

  const features = [
    {
      icon: HeartSolid,
      title: "Interactive Engagement",
      description:
        "Like and comment on posts to engage with the community. Build meaningful connections through authentic interactions.",
    },
    {
      icon: BellSolid,
      title: "Real-time Notifications",
      description:
        "Get instant alerts when someone reacts to your posts. Stay connected and never miss important interactions.",
    },
    {
      icon: UserSolid,
      title: "Personal Profile",
      description:
        "Manage your posts, track engagement, and customize your profile. Full control over your content and presence.",
    },
    {
      icon: EyeSolid,
      title: "Public Browse Mode",
      description:
        "Explore all posts even without an account. Discover amazing content before deciding to join the community.",
    },
    {
      icon: EditSolid,
      title: "Content Management",
      description:
        "Create, edit, and unpublish your posts with ease. Maintain full ownership and control of your content.",
    },
    {
      icon: MessageCaptionSolid,
      title: "Rich Discussions",
      description:
        "Dive deep into conversations with detailed post pages and threaded comments for meaningful discussions.",
    },
  ];

  function handleStartExploring() {
    $goto("/catalogs");
  }

  function handleSignIn() {
    $goto("/login");
  }

  function handleRegister() {
    $goto("/register");
  }

  function handleExploreAsGuest() {
    $goto("/catalogs");
  }

  function handleContactUs() {
    $goto("/contact");
  }
</script>

<div class="home-container">
  <section class="hero-section">
    <div class="hero-content">
      <div class="hero-text">
        <h1 class="hero-title">
          Share Ideas,
          <span class="gradient-text"> Build Community </span>
        </h1>
        <p class="hero-description">
          Catalog is where creators share their thoughts, engage with others,
          and build meaningful connections. Join a community that values
          authentic conversations and quality content.
        </p>

        <div class="hero-buttons">
          <button class="btn-primary" onclick={handleStartExploring}>
            Start Exploring
          </button>
          <button class="btn-secondary" onclick={handleSignIn}>
            Sign In
          </button>
          <button class="btn-secondary" onclick={handleRegister}>
            Create Account
          </button>
        </div>
      </div>
    </div>
  </section>

  <section class="features-section">
    <div class="features-content">
      <div class="features-header">
        <h2 class="features-title">Everything You Need to Connect</h2>
        <p class="features-description">
          Powerful features designed to make sharing and discovering content
          effortless and engaging.
        </p>
      </div>

      <div class="features-grid">
        {#each features as feature}
          <div class="feature-card">
            <div class="feature-icon">
              <feature.icon class="icon" color="white" />
            </div>
            <h3 class="feature-title">
              {feature.title}
            </h3>
            <p class="feature-description">
              {feature.description}
            </p>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <section class="cta-section">
    <div class="cta-content">
      <h2 class="cta-title">Ready to Join the Community?</h2>
      <p class="cta-description">
        Start sharing your ideas, discover amazing content, and connect with
        like-minded creators today.
      </p>

      <div class="cta-buttons">
        <button class="btn-cta-secondary" onclick={handleExploreAsGuest}>
          Explore as Guest
        </button>
        <button
          class="btn-cta-secondary flex items-center"
          onclick={handleContactUs}
        >
          <MessagesOutline class="button-icon mr-2" />
          Contact Us
        </button>
      </div>
    </div>
  </section>

  <footer class="footer-section">
    <div class="footer-content">
      <div class="footer-grid">
        <div class="footer-brand">
          <h3 class="brand-name">Catalog</h3>
          <p class="brand-description">
            Building communities through authentic conversations and meaningful
            connections. Share your story, discover new perspectives.
          </p>
          <div class="social-icons">
            <a href="#" class="social-icon">
              <GlobeSolid class="icon" />
            </a>
            <a href="#" class="social-icon">
              <MessageCaptionSolid class="icon" />
            </a>
            <a href="#" class="social-icon">
              <HeartSolid class="icon" />
            </a>
          </div>
        </div>

        <div class="footer-column">
          <h4 class="footer-column-title">Support</h4>
          <ul class="footer-links">
            <li><a href="/help">Help Center</a></li>
            <li><a href="/community">Community</a></li>
            <li>
              <button onclick={handleContactUs} class="footer-link-button"
                >Contact Us</button
              >
            </li>
            <li><a href="/privacy">Privacy</a></li>
          </ul>
        </div>
      </div>

      <div class="footer-bottom">
        <p>&copy; 2025 Catalog. All rights reserved.</p>
      </div>
    </div>
  </footer>
</div>

<style>
  .home-container {
    min-height: 100vh;
    background: linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%);
    font-family:
      "Inter",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      sans-serif;
  }

  .hero-section {
    padding: 5rem 0 8rem 0;
    position: relative;
  }

  .hero-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  .hero-text {
    text-align: center;
  }

  .hero-title {
    font-size: clamp(2.5rem, 5vw, 4rem);
    font-weight: 800;
    color: #1f2937;
    margin-bottom: 1.5rem;
    line-height: 1.1;
    letter-spacing: -0.02em;
  }

  .gradient-text {
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
  }

  .hero-description {
    font-size: 1.25rem;
    color: #6b7280;
    margin-bottom: 3rem;
    max-width: 48rem;
    margin-left: auto;
    margin-right: auto;
    line-height: 1.6;
  }

  .hero-buttons {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    justify-content: center;
    align-items: center;
    margin-bottom: 4rem;
  }

  @media (min-width: 640px) {
    .hero-buttons {
      flex-direction: row;
    }
  }

  .btn-primary {
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
    color: white;
    font-weight: 600;
    padding: 1rem 2rem;
    border-radius: 0.75rem;
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
    font-size: 1.1rem;
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4);
  }

  .btn-secondary {
    background: white;
    color: #374151;
    font-weight: 600;
    padding: 1rem 2rem;
    border-radius: 0.75rem;
    border: 2px solid #e5e7eb;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 1.1rem;
  }

  .btn-secondary:hover {
    background: #f9fafb;
    border-color: #d1d5db;
    transform: translateY(-1px);
  }

  .features-section {
    padding: 5rem 0;
    background: white;
  }

  .features-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  .features-header {
    text-align: center;
    margin-bottom: 4rem;
  }

  .features-title {
    font-size: clamp(2rem, 4vw, 2.5rem);
    font-weight: 800;
    color: #1f2937;
    margin-bottom: 1rem;
  }

  .features-description {
    font-size: 1.25rem;
    color: #6b7280;
    max-width: 32rem;
    margin: 0 auto;
    line-height: 1.6;
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
  }

  .feature-card {
    background: white;
    padding: 2rem;
    border-radius: 1rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    border: 1px solid #f3f4f6;
    transition: all 0.3s ease;
  }

  .feature-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 25px rgba(0, 0, 0, 0.1);
    border-color: #e5e7eb;
  }

  .feature-icon {
    width: 3rem;
    height: 3rem;
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
    border-radius: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.5rem;
  }

  .feature-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 0.75rem;
  }

  .feature-description {
    color: #6b7280;
    line-height: 1.6;
  }

  .cta-section {
    padding: 5rem 0;
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  }

  .cta-content {
    max-width: 64rem;
    margin: 0 auto;
    padding: 0 1rem;
    text-align: center;
  }

  .cta-title {
    font-size: clamp(2rem, 4vw, 2.5rem);
    font-weight: 800;
    color: white;
    margin-bottom: 1.5rem;
  }

  .cta-description {
    font-size: 1.25rem;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 2rem;
    max-width: 32rem;
    margin-left: auto;
    margin-right: auto;
    line-height: 1.6;
  }

  .cta-buttons {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    justify-content: center;
    align-items: center;
  }

  @media (min-width: 640px) {
    .cta-buttons {
      flex-direction: row;
    }
  }

  .btn-cta-secondary {
    background: transparent;
    color: white;
    font-weight: 600;
    padding: 1rem 2rem;
    border-radius: 0.75rem;
    border: 2px solid white;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 1.1rem;
  }

  .btn-cta-secondary:hover {
    background: white;
    color: #3b82f6;
    transform: translateY(-2px);
  }

  .footer-section {
    background: #111827;
    color: white;
  }

  .footer-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  .footer-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 2rem;
    padding: 3rem 0;
  }

  .footer-brand {
    grid-column: span 2;
  }

  @media (max-width: 768px) {
    .footer-brand {
      grid-column: span 1;
    }
  }

  .brand-name {
    font-size: 1.5rem;
    font-weight: 800;
    background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    margin-bottom: 1rem;
  }

  .brand-description {
    color: #9ca3af;
    margin-bottom: 1.5rem;
    max-width: 24rem;
    line-height: 1.6;
  }

  .social-icons {
    display: flex;
    gap: 1rem;
  }

  .social-icon {
    color: #9ca3af;
    transition: color 0.3s ease;
  }

  .social-icon:hover {
    color: white;
  }

  .footer-column-title {
    font-weight: 700;
    color: white;
    margin-bottom: 1rem;
  }

  .footer-links {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .footer-links li {
    margin-bottom: 0.5rem;
  }

  .footer-links a {
    color: #9ca3af;
    text-decoration: none;
    transition: color 0.3s ease;
  }

  .footer-links a:hover {
    color: white;
  }

  .footer-bottom {
    border-top: 1px solid #374151;
    padding: 2rem 0;
    text-align: center;
    color: #9ca3af;
  }

  @media (max-width: 640px) {
    .hero-section {
      padding: 3rem 0 5rem 0;
    }

    .features-section,
    .cta-section {
      padding: 3rem 0;
    }

    .features-grid {
      grid-template-columns: 1fr;
    }
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .hero-title,
  .hero-description,
  .hero-buttons {
    animation: fadeInUp 0.8s ease-out;
  }

  .hero-description {
    animation-delay: 0.2s;
  }

  .hero-buttons {
    animation-delay: 0.4s;
  }
</style>
