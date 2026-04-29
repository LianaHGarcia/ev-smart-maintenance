import React, { ReactNode, useEffect, useRef } from 'react';
import './About.css';

const sections: { title: string; description: ReactNode; tips: string[] }[] = [
  {
    title: 'Dashboard',
    description: (
      <>This is the main control center. The dashboard shows live health cards of the EV chargers: <strong>Battery state, charge level, motor temperature, and service alerts</strong>. Glance at all your EVs at once or analyse a single vehicle for a detailed status breakdown.</>
    ),
    tips: ['Check the status cards daily for any active alerts.', 'Color-coded indicators: green = healthy, amber = attention, red = action required.'],
  },
  {
    title: 'Maintenance Tracking',
    description: (
      <>Schedule, monitor, and close out maintenance tasks in one place. Set a date, pick a status (Scheduled → In Progress → Completed), and hit <strong>Update Status</strong> to record the change against the vehicle log.</>
    ),
    tips: ['Use "Scheduled" for upcoming work so nothing slips through.', 'Completed tasks are archived. You can review them in Reports.'],
  },
  {
    title: 'Recordings',
    description: (
      <>Access recordings made during the session for learning and documentation purposes.</>
    ),
    tips: ['Use "Scheduled" for upcoming work so nothing slips through.', 'Completed tasks are archived. You can review them in Reports.'],
  },
  {
    title: 'Reports & Analytics',
    description: (
      <>Access historical data across your fleet. The reports page shows trends like recurring faults, average service intervals, and charge-cycle statistics so you can make proactive decisions.</>
    ),
    tips: ['Filter by date range or vehicle to narrow down insights.', 'Export data for use in external tools or stakeholder reviews.'],
  },
  {
    title: 'Getting Around',
    description: (
      <>Use the top navigation bar to move between pages at any time. The nav is always visible so you're never more than one click from any section. The <strong>Get Started</strong> button on the home page takes you straight to the dashboard.</>
    ),
    tips: ['The active page is highlighted in orange in the nav bar.', 'Bookmark any page directly for quick access later.'],
  },
];

const About: React.FC = () => {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.target instanceof HTMLElement) {
            entry.target.classList.add('about-card--visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    cardRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section className="about">
      <h1>How to Use FutureNow Smart Maintenance</h1>
      <p className="about-intro">
        Everything you need to keep your EV fleet in peak condition. Here's what each section does and how to get the most out of it.
      </p>
      <div className="about-cards">
        {sections.map((sec, i) => (
          <div
            key={sec.title}
            className="about-card"
            ref={(el) => { cardRefs.current[i] = el; }}
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <h2>{sec.title}</h2>
            <p>{sec.description}</p>
            <ul>
              {sec.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
};

export default About;
