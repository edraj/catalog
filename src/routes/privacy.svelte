<script>
  import { goto } from "@roxi/routify";
  import {
    ShieldCheckSolid,
    EyeSlashSolid,
    LockSolid,
    UsersSolid,
  } from "flowbite-svelte-icons";
  import { _ } from "@/i18n";
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
          <span class="gradient-text">{$_("privacy.hero.title")}</span>
          {$_("privacy.hero.policy")}
        </h1>
        <p class="hero-description">
          {$_("privacy.hero.description")}
        </p>
      </div>
    </div>
  </section>

  <section class="content-section">
    <div class="content-wrapper">
      <div class="privacy-principles">
        <h2 class="section-title">{$_("privacy.principles.title")}</h2>
        <div class="principles-grid">
          <div class="principle-card">
            <div class="principle-icon">
              <ShieldCheckSolid class="icon" color="white" />
            </div>
            <h3>{$_("privacy.principles.data_protection.title")}</h3>
            <p>
              {$_("privacy.principles.data_protection.description")}
            </p>
          </div>
          <div class="principle-card">
            <div class="principle-icon">
              <EyeSlashSolid class="icon" color="white" />
            </div>
            <h3>{$_("privacy.principles.minimal_collection.title")}</h3>
            <p>
              {$_("privacy.principles.minimal_collection.description")}
            </p>
          </div>
          <div class="principle-card">
            <div class="principle-icon">
              <LockSolid class="icon" color="white" />
            </div>
            <h3>{$_("privacy.principles.secure_storage.title")}</h3>
            <p>
              {$_("privacy.principles.secure_storage.description")}
            </p>
          </div>
          <div class="principle-card">
            <div class="principle-icon">
              <UsersSolid class="icon" color="white" />
            </div>
            <h3>{$_("privacy.principles.user_control.title")}</h3>
            <p>
              {$_("privacy.principles.user_control.description")}
            </p>
          </div>
        </div>
      </div>

      <div class="privacy-details">
        <div class="detail-section">
          <h3>{$_("privacy.information_collect.title")}</h3>
          <ul>
            <li>{$_("privacy.information_collect.account_info")}</li>
            <li>{$_("privacy.information_collect.content")}</li>
            <li>{$_("privacy.information_collect.usage_data")}</li>
            <li>{$_("privacy.information_collect.communication")}</li>
          </ul>
        </div>

        <div class="detail-section">
          <h3>{$_("privacy.how_we_use.title")}</h3>
          <ul>
            <li>{$_("privacy.how_we_use.provide_services")}</li>
            <li>{$_("privacy.how_we_use.personalize")}</li>
            <li>{$_("privacy.how_we_use.communicate")}</li>
            <li>{$_("privacy.how_we_use.improve")}</li>
          </ul>
        </div>

        <div class="detail-section">
          <h3>{$_("privacy.data_sharing.title")}</h3>
          <p>
            {$_("privacy.data_sharing.description")}
          </p>
          <ul>
            <li>{$_("privacy.data_sharing.consent")}</li>
            <li>{$_("privacy.data_sharing.legal")}</li>
            <li>{$_("privacy.data_sharing.protect_rights")}</li>
            <li>{$_("privacy.data_sharing.service_providers")}</li>
          </ul>
        </div>

        <div class="detail-section">
          <h3>{$_("privacy.your_rights.title")}</h3>
          <ul>
            <li>{$_("privacy.your_rights.access")}</li>
            <li>{$_("privacy.your_rights.correct")}</li>
            <li>{$_("privacy.your_rights.delete")}</li>
            <li>{$_("privacy.your_rights.export")}</li>
            <li>{$_("privacy.your_rights.opt_out")}</li>
          </ul>
        </div>

        <div class="contact-section">
          <h3>{$_("privacy.questions.title")}</h3>
          <p>
            {$_("privacy.questions.description")}
          </p>
          <button class="btn-contact" onclick={handleContactUs}>
            {$_("privacy.questions.button")}
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
