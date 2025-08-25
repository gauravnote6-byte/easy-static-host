const stats = [
  {
    number: "10M+",
    label: "Active Users",
    description: "Developers worldwide trust our platform",
  },
  {
    number: "99.9%",
    label: "Uptime",
    description: "Guaranteed reliability and performance",
  },
  {
    number: "50+",
    label: "Countries",
    description: "Global infrastructure coverage",
  },
  {
    number: "24/7",
    label: "Support",
    description: "Expert assistance whenever you need it",
  },
];

const StatsSection = () => {
  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Trusted by Millions
            <span className="bg-gradient-primary bg-clip-text text-transparent"> Worldwide</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Our platform powers some of the world's most innovative companies and ambitious projects.
          </p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center group">
              <div className="mb-4">
                <div className="text-4xl md:text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2 group-hover:scale-110 transition-transform duration-300">
                  {stat.number}
                </div>
                <div className="text-lg font-semibold text-foreground mb-1">
                  {stat.label}
                </div>
                <div className="text-sm text-muted-foreground">
                  {stat.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;