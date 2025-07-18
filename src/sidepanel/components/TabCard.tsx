import React from 'react';
import { z } from 'zod';
import { cn } from '@/sidepanel/lib/utils';
import styles from '../styles/components/TabCard.module.scss';

// Zod schema for TabCard props
const TabCardPropsSchema = z.object({
  faviconUrl: z.string().url().optional(),  // URL to the tab's favicon
  title: z.string(),  // Tab title
  url: z.string().url(),  // Tab URL  
  highlighted: z.boolean().default(false),  // Whether this tab should be highlighted
  className: z.string().optional(),  // Additional CSS classes
  onClick: z.function().optional(),  // Click handler
});

export type TabCardProps = z.infer<typeof TabCardPropsSchema>;

interface TabCardComponentProps {
  faviconUrl?: string;  // URL to the tab's favicon
  title: string;  // Tab title
  url: string;  // Tab URL
  highlighted?: boolean;  // Whether this tab should be highlighted (e.g., as the current tab)
  className?: string;  // Additional CSS classes
  onClick?: () => void;  // Click handler
}

/**
 * TabCard Component
 * 
 * Displays information about a browser tab in a card format.
 * Shows favicon, title, URL, and optional highlighting.
 */
export const TabCard: React.FC<TabCardComponentProps> = ({
  faviconUrl,
  title,
  url,
  highlighted = false,
  className,
  onClick
}) => {
  // Truncate long titles and URLs for better display
  const trimmedTitle = title && title.length > 30 
    ? `${title.substring(0, 27)}...` 
    : title;
    
  const trimmedUrl = url && url.length > 40 
    ? `${url.substring(0, 37)}...` 
    : url;
  
  return (
    <div 
      className={cn(
        styles.tabCard, 
        highlighted && styles.highlighted,
        onClick && styles.clickable,
        className
      )}
      onClick={onClick}
    >
      <div className={styles.tabCardContent}>
        {/* Favicon container */}
        <div className={styles.tabFaviconContainer}>
          {faviconUrl ? (
            <img src={faviconUrl} alt="" className={styles.tabFavicon} />
          ) : (
            <div className={styles.defaultFavicon}></div>
          )}
        </div>
        
        {/* Tab information */}
        <div className={styles.tabInfo}>
          <div className={styles.tabTitle}>{trimmedTitle || 'Unknown page'}</div>
          <div className={styles.tabUrl}>{trimmedUrl || ''}</div>
        </div>
        
        {/* Action/status indicator */}
        <div className={styles.tabAction}>
          {highlighted && (
            <div className={styles.tabCurrentIndicator}>Current</div>
          )}
        </div>
      </div>
    </div>
  );
};
