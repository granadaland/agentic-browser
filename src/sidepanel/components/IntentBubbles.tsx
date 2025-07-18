import React from 'react';
import { z } from 'zod';
import { cn } from '@/sidepanel/lib/utils';
import styles from '../styles/components/IntentBubbles.module.scss';

// Intent bubble props schema
const IntentBubblesPropsSchema = z.object({
  intents: z.array(z.string()),  // Array of intent strings
  onIntentClick: z.function().args(z.string()).returns(z.void()),  // Handler for intent click
  isLoading: z.boolean().optional(),  // Whether predictions are loading
  className: z.string().optional()  // Additional CSS classes
});

export type IntentBubblesProps = z.infer<typeof IntentBubblesPropsSchema>;

/**
 * Component to display predicted user intents as clickable bubbles
 */
export const IntentBubbles: React.FC<IntentBubblesProps> = ({
  intents,
  onIntentClick,
  isLoading = false,
  className
}) => {
  // Don't render if no intents and not loading
  if (!isLoading && intents.length === 0) {
    return null;
  }

  return (
    <div className={cn(styles.container, className)}>
      <div className={styles.header}>
        <span className={styles.title}>Suggested actions</span>
        {isLoading && (
          <span className={styles.loadingIndicator}>
            <span className={styles.loadingDot} />
            <span className={styles.loadingDot} />
            <span className={styles.loadingDot} />
          </span>
        )}
      </div>
      
      <div className={styles.bubblesList}>
        {isLoading ? (
          // Loading skeletons
          <div className={styles.loadingContainer}>
            {[1, 2, 3].map(i => (
              <div key={i} className={styles.bubbleSkeleton} />
            ))}
          </div>
        ) : (
          // Actual intent bubbles
          intents.map((intent, index) => (
            <button
              key={`${intent}-${index}`}
              className={styles.bubble}
              onClick={() => onIntentClick(intent)}
              title={intent}
            >
              <span className={styles.bubbleIcon}>💡</span>
              <span className={styles.bubbleText}>{intent}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};