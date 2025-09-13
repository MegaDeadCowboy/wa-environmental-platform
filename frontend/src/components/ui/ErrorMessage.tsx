// src/components/ui/ErrorMessage.tsx
import React from 'react';
import styles from './ErrorMessage.module.css';

interface ErrorMessageProps {
  error: string | Error;
  onRetry?: () => void;
  theme?: 'air' | 'water' | 'default';
  size?: 'small' | 'medium' | 'large';
  showDetails?: boolean;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({
  error,
  onRetry,
  theme = 'default',
  size = 'medium',
  showDetails = false
}) => {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorDetails = error instanceof Error ? error.stack : '';

  const getErrorIcon = () => {
    switch (theme) {
      case 'air':
        return '🌫️';
      case 'water':
        return '💧';
      default:
        return '⚠️';
    }
  };

  const getContextualMessage = () => {
    if (errorMessage.toLowerCase().includes('network')) {
      return 'Network connection issue. Please check your internet connection.';
    }
    if (errorMessage.toLowerCase().includes('api')) {
      return 'Unable to load environmental data from server.';
    }
    if (errorMessage.toLowerCase().includes('timeout')) {
      return 'Request timed out. The server may be experiencing high load.';
    }
    return errorMessage;
  };

  return (
    <div className={`${styles.container} ${styles[size]} ${styles[theme]}`} role="alert">
      <div className={styles.content}>
        <div className={styles.icon} aria-hidden="true">
          {getErrorIcon()}
        </div>
        
        <div className={styles.messageContainer}>
          <h3 className={styles.title}>
            {theme === 'air' ? 'Air Quality Data Error' : 
             theme === 'water' ? 'Water Quality Data Error' : 
             'Data Loading Error'}
          </h3>
          
          <p className={styles.message}>
            {getContextualMessage()}
          </p>
          
          {showDetails && errorDetails && (
            <details className={styles.details}>
              <summary className={styles.detailsToggle}>
                Technical Details
              </summary>
              <pre className={styles.errorStack}>
                {errorDetails}
              </pre>
            </details>
          )}
        </div>
      </div>
      
      {onRetry && (
        <div className={styles.actions}>
          <button 
            className={styles.retryButton}
            onClick={onRetry}
            aria-label="Retry loading data"
          >
            🔄 Try Again
          </button>
        </div>
      )}
    </div>
  );
};

export default ErrorMessage;