/**
 * The context of the post that the template 525 renders.
 *
 * The widgets of the template (`theme-post-title`, `post-content`, …) need
 * the data of the post that is being rendered.
 */
import type { CollectionEntry } from 'astro:content';

export interface PostContext {
  entry: CollectionEntry<'blog'>;
  /** the component that renders the body of the post */
  Content: any;
  /** the posts that are related to the post being rendered */
  related: CollectionEntry<'blog'>[];
}
