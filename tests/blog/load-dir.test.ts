import { join } from 'path';
import { blogDataDir, clearBlogCache, defaultArticlesDir, defaultFilmsPath, loadArticles, loadFilms } from '../../lib/blog/load';

describe('BLOG_DATA_DIR', () => {
  const saved = process.env.BLOG_DATA_DIR;
  afterEach(() => {
    if (saved === undefined) delete process.env.BLOG_DATA_DIR;
    else process.env.BLOG_DATA_DIR = saved;
    clearBlogCache();
  });

  it('defaults to data/blog', () => {
    delete process.env.BLOG_DATA_DIR;
    expect(blogDataDir()).toBe(join(process.cwd(), 'data/blog'));
    expect(defaultFilmsPath()).toBe(join(process.cwd(), 'data/blog/films.json'));
    expect(defaultArticlesDir()).toBe(join(process.cwd(), 'data/blog/articles'));
  });

  it('points the loaders at another directory (relative to the cwd)', () => {
    process.env.BLOG_DATA_DIR = 'tests/blog/fixtures';
    clearBlogCache();
    expect(defaultFilmsPath()).toBe(join(process.cwd(), 'tests/blog/fixtures/films.json'));
    expect(loadFilms()).toHaveLength(12);
    expect(loadArticles().some((a) => a.status === 'published')).toBe(true);
  });

  it('accepts an absolute directory and ignores a blank value', () => {
    process.env.BLOG_DATA_DIR = join(process.cwd(), 'tests/blog/fixtures');
    expect(defaultArticlesDir()).toBe(join(process.cwd(), 'tests/blog/fixtures/articles'));
    process.env.BLOG_DATA_DIR = '   ';
    expect(blogDataDir()).toBe(join(process.cwd(), 'data/blog'));
  });
});
