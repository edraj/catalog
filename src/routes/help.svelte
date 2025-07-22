<script>
  import { goto } from "@roxi/routify";
  import {
    BookOpenSolid,
    ChevronDownOutline,
    EnvelopeSolid,
    MessagesSolid,
    QuestionCircleSolid,
  } from "flowbite-svelte-icons";
  $goto;
  let openFaq = $state(null);

  const faqs = [
    {
      question: "How do I create my first catalog?",
      answer:
        "To create a catalog, navigate to your dashboard and click 'Create New Catalog'. Fill in the required information like title, description, and category. You can then start adding entries to organize your content.",
    },
    {
      question: "Can I collaborate with others on catalogs?",
      answer:
        "Yes! You can invite other users to collaborate on your catalogs. Go to your catalog settings and use the 'Invite Collaborators' feature to add team members with different permission levels.",
    },
    {
      question: "How do I make my catalog public?",
      answer:
        "In your catalog settings, you can change the visibility from 'Private' to 'Public'. Public catalogs can be discovered and viewed by anyone on the platform.",
    },
    {
      question: "What types of content can I add to catalogs?",
      answer:
        "You can add various types of content including text entries, images, links, documents, and rich media. Each entry can have metadata, tags, and descriptions to help organize your content.",
    },
    {
      question: "How do I search for specific content?",
      answer:
        "Use the search bar at the top of the page to find catalogs, entries, or users. You can filter results by category, date, or content type to narrow down your search.",
    },
    {
      question: "Can I export my catalog data?",
      answer:
        "Yes, you can export your catalog data in various formats including JSON, CSV, or PDF. Go to your catalog settings and look for the 'Export' option.",
    },
  ];

  function toggleFaq(index) {
    openFaq = openFaq === index ? null : index;
  }

  function handleContactSupport() {
    $goto("/contact");
  }

  function handleJoinCommunity() {
    $goto("/community");
  }

  function handleExploreCatalogs() {
    $goto("/catalogs");
  }
</script>

<div class="help-container">
  <section class="hero-section">
    <div class="hero-content">
      <div class="hero-text">
        <h1 class="hero-title">
          <span class="gradient-text">Help</span> Center
        </h1>
        <p class="hero-description">
          Find answers to common questions, learn how to use our platform, and
          get the support you need.
        </p>
      </div>
    </div>
  </section>

  <section class="quick-help-section">
    <div class="quick-help-content">
      <h2 class="section-title">Quick Help</h2>
      <div class="help-cards">
        <div class="help-card">
          <div class="help-icon">
            <BookOpenSolid class="icon" color="white" />
          </div>
          <h3>Getting Started</h3>
          <p>Learn the basics of creating and managing your catalogs.</p>
          <button class="help-button" onclick={handleExploreCatalogs}>
            Explore Catalogs
          </button>
        </div>
        <div class="help-card">
          <div class="help-icon">
            <MessagesSolid class="icon" color="white" />
          </div>
          <h3>Community Support</h3>
          <p>Connect with other users and get help from the community.</p>
          <button class="help-button" onclick={handleJoinCommunity}>
            Join Community
          </button>
        </div>
        <div class="help-card">
          <div class="help-icon">
            <EnvelopeSolid class="icon" color="white" />
          </div>
          <h3>Contact Support</h3>
          <p>Need direct help? Reach out to our support team.</p>
          <button class="help-button" onclick={handleContactSupport}>
            Contact Us
          </button>
        </div>
      </div>
    </div>
  </section>

  <section class="faq-section">
    <div class="faq-content">
      <h2 class="section-title">Frequently Asked Questions</h2>
      <div class="faq-list">
        {#each faqs as faq, index}
          <div class="faq-item">
            <button
              class="faq-question"
              onclick={() => toggleFaq(index)}
              class:active={openFaq === index}
            >
              <span>{faq.question}</span>
              <ChevronDownOutline
                class="chevron {openFaq === index ? 'rotated' : ''}"
              />
            </button>
            {#if openFaq === index}
              <div class="faq-answer">
                <p>{faq.answer}</p>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </section>

  <section class="support-section">
    <div class="support-content">
      <div class="support-card">
        <QuestionCircleSolid class="support-icon" />
        <h3>Still Need Help?</h3>
        <p>
          Can't find what you're looking for? Our support team is here to help
          you with any questions or issues.
        </p>
        <button class="btn-support" onclick={handleContactSupport}>
          Get Support
        </button>
      </div>
    </div>
  </section>
</div>

<style>
  .help-container {
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

  .quick-help-section {
    padding: 2rem 0 4rem 0;
    background: white;
  }

  .quick-help-content {
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

  .help-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
  }

  .help-card {
    background: white;
    padding: 2rem;
    border-radius: 1rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    border: 1px solid #f3f4f6;
    text-align: center;
    transition: all 0.3s ease;
  }

  .help-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 25px rgba(0, 0, 0, 0.1);
  }

  .help-icon {
    width: 3rem;
    height: 3rem;
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
    border-radius: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.5rem auto;
  }

  .help-card h3 {
    font-size: 1.25rem;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 0.75rem;
  }

  .help-card p {
    color: #6b7280;
    line-height: 1.6;
    margin-bottom: 1.5rem;
  }

  .help-button {
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
    color: white;
    font-weight: 600;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 0.9rem;
  }

  .help-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
  }

  .faq-section {
    padding: 4rem 0;
    background: #f9fafb;
  }

  .faq-content {
    max-width: 800px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  .faq-list {
    space-y: 1rem;
  }

  .faq-item {
    background: white;
    border-radius: 0.75rem;
    border: 1px solid #e5e7eb;
    overflow: hidden;
    margin-bottom: 1rem;
  }

  .faq-question {
    width: 100%;
    padding: 1.5rem;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 1.1rem;
    font-weight: 600;
    color: #1f2937;
    transition: all 0.3s ease;
  }

  .faq-question:hover {
    background: #f9fafb;
  }

  .faq-question.active {
    background: #f0f9ff;
    color: #3b82f6;
  }

  .chevron {
    width: 1.25rem;
    height: 1.25rem;
    transition: transform 0.3s ease;
    color: #6b7280;
  }

  .chevron.rotated {
    transform: rotate(180deg);
  }

  .faq-answer {
    padding: 0 1.5rem 1.5rem 1.5rem;
    border-top: 1px solid #f3f4f6;
    background: #f9fafb;
  }

  .faq-answer p {
    color: #6b7280;
    line-height: 1.6;
    margin: 1rem 0 0 0;
  }

  .support-section {
    padding: 4rem 0;
    background: white;
  }

  .support-content {
    max-width: 600px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  .support-card {
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
    padding: 3rem 2rem;
    border-radius: 1rem;
    text-align: center;
    color: white;
  }

  .support-icon {
    width: 4rem;
    height: 4rem;
    margin: 0 auto 1.5rem auto;
    color: white;
  }

  .support-card h3 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 1rem;
  }

  .support-card p {
    font-size: 1.1rem;
    margin-bottom: 2rem;
    opacity: 0.9;
    line-height: 1.6;
  }

  .btn-support {
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

  .btn-support:hover {
    background: #f9fafb;
    transform: translateY(-2px);
  }

  @media (max-width: 640px) {
    .hero-section {
      padding: 3rem 0 2rem 0;
    }

    .quick-help-section,
    .faq-section,
    .support-section {
      padding: 3rem 0;
    }

    .help-cards {
      grid-template-columns: 1fr;
    }

    .support-card {
      padding: 2rem 1.5rem;
    }
  }
</style>
