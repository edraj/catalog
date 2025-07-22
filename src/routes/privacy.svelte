<script>
  import { goto } from "@roxi/routify";
  import {
    ShieldCheckSolid,
    EyeSlashSolid,
    LockSolid,
    UsersSolid,
  } from "flowbite-svelte-icons";
  $goto;
  function handleContactUs() {
    $goto("/contact");
  }
</script>

<div class="privacy-container">
  <section class="hero-section">
    <div class="hero-content">
      <div class="hero-text">
        <h1 class="hero-title">
          <span class="gradient-text">Privacy</span> Policy
        </h1>
        <p class="hero-description">
          We value your privacy and are committed to protecting your personal
          information. Learn how we collect, use, and safeguard your data.
        </p>
      </div>
    </div>
  </section>

  <section class="content-section">
    <div class="content-wrapper">
      <div class="privacy-principles">
        <h2 class="section-title">Our Privacy Principles</h2>
        <div class="principles-grid">
          <div class="principle-card">
            <div class="principle-icon">
              <ShieldCheckSolid class="icon" color="white" />
            </div>
            <h3>Data Protection</h3>
            <p>
              We use industry-standard security measures to protect your
              personal information.
            </p>
          </div>
          <div class="principle-card">
            <div class="principle-icon">
              <EyeSlashSolid class="icon" color="white" />
            </div>
            <h3>Minimal Collection</h3>
            <p>
              We only collect data that is necessary to provide and improve our
              services.
            </p>
          </div>
          <div class="principle-card">
            <div class="principle-icon">
              <LockSolid class="icon" color="white" />
            </div>
            <h3>Secure Storage</h3>
            <p>
              Your data is encrypted and stored securely with limited access
              controls.
            </p>
          </div>
          <div class="principle-card">
            <div class="principle-icon">
              <UsersSolid class="icon" color="white" />
            </div>
            <h3>User Control</h3>
            <p>
              You have control over your data and can request access, updates,
              or deletion.
            </p>
          </div>
        </div>
      </div>

      <div class="privacy-details">
        <div class="detail-section">
          <h3>Information We Collect</h3>
          <ul>
            <li>Account information (username, email, profile details)</li>
            <li>Content you create and share on the platform</li>
            <li>Usage data and analytics to improve our services</li>
            <li>Communication data when you contact us</li>
          </ul>
        </div>

        <div class="detail-section">
          <h3>How We Use Your Information</h3>
          <ul>
            <li>To provide and maintain our catalog services</li>
            <li>To personalize your experience on the platform</li>
            <li>To communicate with you about updates and features</li>
            <li>To improve our services and develop new features</li>
          </ul>
        </div>

        <div class="detail-section">
          <h3>Data Sharing</h3>
          <p>
            We do not sell your personal information. We may share data only in
            these limited circumstances:
          </p>
          <ul>
            <li>With your explicit consent</li>
            <li>To comply with legal obligations</li>
            <li>To protect our rights and prevent fraud</li>
            <li>With service providers who help us operate the platform</li>
          </ul>
        </div>

        <div class="detail-section">
          <h3>Your Rights</h3>
          <ul>
            <li>Access your personal data</li>
            <li>Correct inaccurate information</li>
            <li>Delete your account and data</li>
            <li>Export your data</li>
            <li>Opt out of marketing communications</li>
          </ul>
        </div>

        <div class="contact-section">
          <h3>Questions About Privacy?</h3>
          <p>
            If you have any questions about this privacy policy or how we handle
            your data, please don't hesitate to contact us.
          </p>
          <button class="btn-contact" onclick={handleContactUs}>
            Contact Us
          </button>
        </div>
      </div>
    </div>
  </section>
</div>

<style>
  .privacy-container {
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
    padding: 4rem 0 3rem 0;
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
    font-size: clamp(2.5rem, 5vw, 3.5rem);
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
    max-width: 48rem;
    margin: 0 auto;
    line-height: 1.6;
  }

  .content-section {
    padding: 2rem 0 4rem 0;
    background: white;
  }

  .content-wrapper {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  .section-title {
    font-size: 2rem;
    font-weight: 800;
    color: #1f2937;
    text-align: center;
    margin-bottom: 3rem;
  }

  .principles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 2rem;
    margin-bottom: 4rem;
  }

  .principle-card {
    background: white;
    padding: 2rem;
    border-radius: 1rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    border: 1px solid #f3f4f6;
    text-align: center;
    transition: all 0.3s ease;
  }

  .principle-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 25px rgba(0, 0, 0, 0.1);
  }

  .principle-icon {
    width: 3rem;
    height: 3rem;
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
    border-radius: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.5rem auto;
  }

  .principle-card h3 {
    font-size: 1.25rem;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 0.75rem;
  }

  .principle-card p {
    color: #6b7280;
    line-height: 1.6;
  }

  .privacy-details {
    max-width: 800px;
    margin: 0 auto;
  }

  .detail-section {
    margin-bottom: 3rem;
    padding: 2rem;
    background: #f9fafb;
    border-radius: 1rem;
    border: 1px solid #e5e7eb;
  }

  .detail-section h3 {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 1rem;
  }

  .detail-section p {
    color: #6b7280;
    line-height: 1.6;
    margin-bottom: 1rem;
  }

  .detail-section ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .detail-section li {
    color: #6b7280;
    line-height: 1.6;
    margin-bottom: 0.5rem;
    padding-left: 1.5rem;
    position: relative;
  }

  .detail-section li::before {
    content: "•";
    color: #3b82f6;
    font-weight: bold;
    position: absolute;
    left: 0;
  }

  .contact-section {
    text-align: center;
    padding: 3rem 2rem;
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
    border-radius: 1rem;
    color: white;
  }

  .contact-section h3 {
    color: white !important;
    margin-bottom: 1rem;
  }

  .contact-section p {
    color: rgba(255, 255, 255, 0.9) !important;
    margin-bottom: 2rem;
  }

  .btn-contact {
    background: white;
    color: #3b82f6;
    font-weight: 600;
    padding: 1rem 2rem;
    border-radius: 0.75rem;
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 1.1rem;
  }

  .btn-contact:hover {
    background: #f9fafb;
    transform: translateY(-2px);
  }

  @media (max-width: 640px) {
    .hero-section {
      padding: 3rem 0 2rem 0;
    }

    .content-section {
      padding: 1rem 0 3rem 0;
    }

    .detail-section {
      padding: 1.5rem;
    }
  }
</style>
