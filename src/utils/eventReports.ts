type EventReportModule = {
  frontmatter: {
    date: Date | string;
  };
};

const reportModules = import.meta.glob<EventReportModule>('../content/news/*.md', { eager: true });

function getSlug(filepath: string) {
  return filepath.split(/[\\/]/).pop()?.replace('.md', '') || '';
}

function getDateKey(date: Date | string) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const eventReportEntries = Object.entries(reportModules).map(([filepath, report]) => ({
  slug: getSlug(filepath),
  report,
}));

const eventReportSlugByDate = new Map(
  eventReportEntries.map(({ slug, report }) => [getDateKey(report.frontmatter.date), slug])
);

export function getEventReportSlugForDate(date: string) {
  return eventReportSlugByDate.get(date) || date;
}
