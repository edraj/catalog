<script>
  import { goto } from "@roxi/routify";
  import {
    UsersSolid,
    MessageCaptionSolid,
    HeartSolid,
    GlobeSolid,
  } from "flowbite-svelte-icons";
  import { _ } from "@/i18n";
  $goto;
  const communityFeatures = [
    {
      icon: UsersSolid,
      title: "Connect with Others",
      description:
        "Join a vibrant community of creators, curators, and enthusiasts sharing knowledge and ideas.",
    },
    {
      icon: MessageCaptionSolid,
      title: "Rich Discussions",
      description:
        "Engage in meaningful conversations about content, share feedback, and collaborate on projects.",
    },
    {
      icon: HeartSolid,
      title: "Support & Recognition",
      description:
        "Show appreciation for quality content and get recognized for your contributions to the community.",
    },
    {
      icon: GlobeSolid,
      title: "Global Network",
      description:
        "Connect with people from around the world who share your interests and passions.",
    },
  ];

  function handleJoinCommunity() {
    $goto("/register");
  }

  function handleExploreCatalogs() {
    $goto("/catalogs");
  }
</script>

<div class="community-container">
  <section class="hero-section">
    <div class="hero-content">
      <div class="hero-text">
        <h1 class="hero-title">
          Join Our <span class="gradient-text">Community</span>
        </h1>
        <p class="hero-description">
          Connect with like-minded individuals, share your knowledge, and be
          part of a growing community that values collaboration and creativity.
        </p>
        <div class="hero-buttons">
          <button class="btn-primary" onclick={handleJoinCommunity}>
            Join Community
          </button>
          <button class="btn-secondary" onclick={handleExploreCatalogs}>
            Explore Catalogs
          </button>
        </div>
      </div>
    </div>
  </section>

  <section class="features-section">
    <div class="features-content">
      <div class="features-header">
        <h2 class="features-title">Why Join Our Community?</h2>
        <p class="features-description">
          Discover the benefits of being part of our collaborative platform.
        </p>
      </div>

      <div class="features-grid">
        {#each communityFeatures as feature}
          <div class="feature-card">
            <div class="feature-icon">
              <feature.icon class="icon" color="white" />
            </div>
            <h3 class="feature-title">{feature.title}</h3>
            <p class="feature-description">{feature.description}</p>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <section class="guidelines-section">
    <div class="guidelines-content">
      <h2 class="guidelines-title">Community Guidelines</h2>
      <div class="guidelines-grid">
        <div class="guideline-item">
          <h3>Be Respectful</h3>
          <p>Treat all community members with respect and kindness.</p>
        </div>
        <div class="guideline-item">
          <h3>Share Quality Content</h3>
          <p>
            Contribute meaningful and well-organized content to the catalogs.
          </p>
        </div>
        <div class="guideline-item">
          <h3>Collaborate</h3>
          <p>Work together to improve content and help others succeed.</p>
        </div>
        <div class="guideline-item">
          <h3>Stay On Topic</h3>
          <p>Keep discussions relevant and constructive.</p>
        </div>
      </div>
    </div>
  </section>
</div>

<style>
  .community-container {
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
    padding: 5rem 0 6rem 0;
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
  }

  .gradient-text {
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
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
    padding: 4rem 0;
    background: white;
  }

  .features-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  .features-header {
    text-align: center;
    margin-bottom: 3rem;
  }

  .features-title {
    font-size: 2.5rem;
    font-weight: 800;
    color: #1f2937;
    margin-bottom: 1rem;
  }

  .features-description {
    font-size: 1.25rem;
    color: #6b7280;
    max-width: 32rem;
    margin: 0 auto;
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
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

  .guidelines-section {
    padding: 4rem 0;
    background: #f9fafb;
  }

  .guidelines-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  .guidelines-title {
    font-size: 2.5rem;
    font-weight: 800;
    color: #1f2937;
    text-align: center;
    margin-bottom: 3rem;
  }

  .guidelines-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 2rem;
  }

  .guideline-item {
    background: white;
    padding: 2rem;
    border-radius: 1rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    border: 1px solid #e5e7eb;
  }

  .guideline-item h3 {
    font-size: 1.25rem;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 0.75rem;
  }

  .guideline-item p {
    color: #6b7280;
    line-height: 1.6;
  }

  @media (max-width: 640px) {
    .hero-section {
      padding: 3rem 0 4rem 0;
    }

    .features-section,
    .guidelines-section {
      padding: 3rem 0;
    }
  }
</style>
