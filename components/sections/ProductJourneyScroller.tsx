const stages = [
  {
    number: "01",
    title: "Browse with context",
    copy: "See approved product names and concise distinctions in one calm catalogue.",
  },
  {
    number: "02",
    title: "Read what is known",
    copy: "Ingredients, usage, packs, allergens and storage appear only when those details are supplied.",
  },
  {
    number: "03",
    title: "Enquire directly",
    copy: "When a verified contact channel is configured, each product can carry its details into the enquiry.",
  },
];

export function ProductJourneyScroller() {
  return (
    <section className="journey section" aria-labelledby="journey-heading">
      <div className="shell journey-layout">
        <div className="journey-intro">
          <p className="eyebrow">A clear path</p>
          <h2 id="journey-heading">From discovery to a direct conversation.</h2>
          <p>
            The experience is deliberately simple: useful detail first, then one clear next step.
          </p>
        </div>
        <ol className="journey-list">
          {stages.map((stage, index) => (
            <li key={stage.number} aria-current={index === 0 ? "step" : undefined}>
              <span className="journey-number">{stage.number}</span>
              <div>
                <h3>{stage.title}</h3>
                <p>{stage.copy}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
