import type { FeedbackSubmission } from '@/lib/types/feedback'

/**
 * Firebase Feedback Service
 * Handles feedback submission to Firebase Firestore
 * Note: Firebase configuration should be added to the project
 */

// Firebase configuration from environment variables
const FIREBASE_CONFIG = {
  apiKey: process.env.FIREBASE_API_KEY || '',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.FIREBASE_APP_ID || '',
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || ''
};

// Firebase will be enabled if projectId is provided
const FIREBASE_ENABLED = !!process.env.FIREBASE_PROJECT_ID;

class FeedbackService {
  private static instance: FeedbackService;
  private initialized = false;
  private db: any = null; // Firestore instance

  static getInstance(): FeedbackService {
    if (!FeedbackService.instance) {
      FeedbackService.instance = new FeedbackService()
    }
    return FeedbackService.instance
  }

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Detect operating system from user agent
   */
  private _detectOperatingSystem(): string {
    const userAgent = navigator.userAgent.toLowerCase()
    
    if (userAgent.includes('mac')) return 'Mac'
    if (userAgent.includes('win')) return 'Windows'  
    if (userAgent.includes('linux')) return 'Linux'
    
    return 'Unknown'
  }

  /**
   * Initialize Firebase (lazy loading)
   * This will be called only when feedback is actually submitted
   */
  private async _initializeFirebase(): Promise<boolean> {
    if (this.initialized) return true
    if (!FIREBASE_ENABLED) return false

    try {
      const { initializeApp } = await import('firebase/app')
      const { getFirestore } = await import('firebase/firestore')
      
      const app = initializeApp(FIREBASE_CONFIG)
      this.db = getFirestore(app)
      
      this.initialized = true
      return true
    } catch (error) {
      console.error('Failed to initialize Firebase:', error)
      return false
    }
  }

  /**
   * Submit feedback to Firebase
   * For now, this just logs the feedback (Firebase setup needed)
   */
  async submitFeedback(feedback: FeedbackSubmission): Promise<void> {
    const isInitialized = await this._initializeFirebase()
    
    if (!isInitialized) {
      console.warn('Firebase not initialized, feedback will be logged locally')
      console.log('Feedback submission:', {
        feedbackId: feedback.feedbackId,
        messageId: feedback.messageId,
        type: feedback.type,
        hasTextFeedback: !!feedback.textFeedback,
        timestamp: feedback.timestamp
      })
      return
    }

    try {
      if (!isInitialized) {
        // Firebase not configured - log locally for now
        console.log('Feedback stored locally (Firebase not configured):', {
          userQuery: feedback.userQuery || 'No user query',
          operatingSystem: this._detectOperatingSystem(),
          feedbackText: feedback.textFeedback || 'No feedback text',
          submittedAt: new Date().toLocaleString()
        })
        return
      }

      // Submit to Firebase when enabled
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore')
      
    
      const feedbackData = {
        userQuery: feedback.userQuery || 'No user query',
        agentResponse: feedback.agentResponse || 'No response available',
        feedbackText: feedback.textFeedback || 'No feedback text',
        operatingSystem: this._detectOperatingSystem(),
        submittedAt: serverTimestamp() 
      }
      
      await addDoc(collection(this.db, 'feedbacks'), feedbackData)
      console.log('Feedback successfully submitted to Firebase!')
      
      
    } catch (error) {
      console.error('Failed to submit feedback to Firebase:', error)
      throw new Error('Failed to submit feedback')
    }
  }

  /**
   * Get feedback statistics (for analytics)
   * This would query Firebase for aggregate data
   */
  async getFeedbackStats(): Promise<{
    totalFeedback: number
    positiveRatio: number
    commonIssues: string[]
  }> {
  
    return {
      totalFeedback: 0,
      positiveRatio: 0,
      commonIssues: []
    }
  }
}

export const feedbackService = FeedbackService.getInstance()
