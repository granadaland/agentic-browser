import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { MessageManager, MessageManagerReadOnly, MessageType } from "./MessageManager";
import { describe, it, expect, beforeEach } from 'vitest';

describe("MessageManager", () => {
  let manager: MessageManager;

  beforeEach(() => {
    manager = new MessageManager(1000); // Small token limit for testing
  });

  describe("Core message operations", () => {
    it("tests that messages can be added and retrieved", () => {
      manager.addHuman("Hello");
      manager.addAI("Hi there");
      
      const messages = manager.getMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0]).toBeInstanceOf(HumanMessage);
      expect(messages[0].content).toBe("Hello");
      expect(messages[1]).toBeInstanceOf(AIMessage);
      expect(messages[1].content).toBe("Hi there");
    });

    it("tests that system messages are handled with only one allowed", () => {
      manager.addSystem("System 1");
      manager.addHuman("Hello");
      manager.addSystem("System 2");
      
      const messages = manager.getMessages();
      const systemMessages = messages.filter(m => m instanceof SystemMessage);
      expect(systemMessages).toHaveLength(1);
      expect(systemMessages[0].content).toBe("System 2");
    });

    it("tests that tool messages are handled correctly", () => {
      manager.addTool("Tool result", "tool-123");
      
      const messages = manager.getMessages();
      expect(messages[0]).toBeInstanceOf(ToolMessage);
      expect(messages[0].content).toBe("Tool result");
      expect((messages[0] as ToolMessage).tool_call_id).toBe("tool-123");
    });

    it("tests that browser state messages are handled correctly", () => {
      // Add initial messages
      manager.addHuman("Test");
      manager.addBrowserState("First browser state");
      manager.addAI("Response");
      
      let messages = manager.getMessages();
      expect(messages).toHaveLength(3);
      
      // Adding new browser state should replace old one
      manager.addBrowserState("Second browser state");
      messages = manager.getMessages();
      expect(messages).toHaveLength(3); // Still 3 messages
      
      // Check that only the new browser state exists
      const browserStateMessages = messages.filter(msg => 
        msg.additional_kwargs?.messageType === MessageType.BROWSER_STATE
      );
      expect(browserStateMessages).toHaveLength(1);
      expect(browserStateMessages[0].content).toBe("Second browser state");
    });

    it("tests that messages can be removed by type", () => {
      // Add various message types
      manager.addSystem("System");
      manager.addHuman("Human");
      manager.addAI("AI");
      manager.addBrowserState("Browser state");
      manager.addTool("Tool result", "tool_123");
      
      expect(manager.getMessages()).toHaveLength(5);
      
      // Remove AI messages
      manager.removeMessagesByType(MessageType.AI);
      expect(manager.getMessages()).toHaveLength(4);
      
      // Remove browser state messages
      manager.removeMessagesByType(MessageType.BROWSER_STATE);
      expect(manager.getMessages()).toHaveLength(3);
      
      // Remove system messages
      manager.removeMessagesByType(MessageType.SYSTEM);
      expect(manager.getMessages()).toHaveLength(2);
    });

    it("tests that all messages can be cleared", () => {
      manager.addHuman("Hello");
      manager.addAI("Hi");
      manager.clear();
      
      expect(manager.getMessages()).toHaveLength(0);
      expect(manager.getTokenCount()).toBe(0);
    });

    it("tests that last message can be removed", () => {
      manager.addHuman("First");
      manager.addAI("Second");
      
      const removed = manager.removeLast();
      expect(removed).toBe(true);
      expect(manager.getMessages()).toHaveLength(1);
      expect(manager.getMessages()[0].content).toBe("First");
    });
  });

  describe("Token management", () => {
    it("tests that token count is tracked accurately", () => {
      const initialCount = manager.getTokenCount();
      expect(initialCount).toBe(0);
      
      manager.addHuman("Hello world"); // ~11 chars = ~3 tokens + 3 overhead = 6
      const count = manager.getTokenCount();
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(20); // Reasonable upper bound
    });

    it("tests that remaining tokens are calculated correctly", () => {
      const initial = manager.remaining();
      expect(initial).toBe(1000);
      
      manager.addHuman("Hello");
      const remaining = manager.remaining();
      expect(remaining).toBeLessThan(1000);
      expect(remaining).toBeGreaterThan(980); // Should only use a few tokens
    });

    it("tests that messages auto-trim when exceeding token limit", async () => {
      // Add messages until we exceed the limit
      for (let i = 0; i < 50; i++) {
        manager.addHuman(`This is a long message number ${i} with some content to use up tokens`);
      }
      
      // Should have trimmed to stay under limit
      expect(manager.getTokenCount()).toBeLessThanOrEqual(1000);
      
      // Most recent messages should be preserved
      const messages = manager.getMessages();
      const lastMessage = messages[messages.length - 1];
      expect(lastMessage.content).toContain("49"); // Last message should be preserved
    });

    it("tests that system messages are preserved during trimming", async () => {
      manager.addSystem("Important system prompt");
      
      // Add many messages to trigger trimming
      for (let i = 0; i < 50; i++) {
        manager.addHuman(`Message ${i} with lots of content to trigger trimming`);
      }
      
      // System message should still be there
      const messages = manager.getMessages();
      const systemMessages = messages.filter(m => m instanceof SystemMessage);
      expect(systemMessages).toHaveLength(1);
      expect(systemMessages[0].content).toBe("Important system prompt");
    });
  });


  describe("Edge cases", () => {
    it("tests that empty message manager is handled correctly", () => {
      expect(manager.getMessages()).toHaveLength(0);
      expect(manager.getTokenCount()).toBe(0);
      expect(manager.remaining()).toBe(1000);
      expect(manager.removeLast()).toBe(false);
    });

    it("tests that complex content types are handled correctly", () => {
      const complexContent = [
        { type: "text", text: "Check this image:" },
        { type: "image_url", image_url: { url: "https://example.com/image.png" } }
      ];
      
      manager.add(new HumanMessage({ content: complexContent }));
      
      const messages = manager.getMessages();
      expect(messages).toHaveLength(1);
      expect(manager.getTokenCount()).toBeGreaterThan(0);
    });

    it("tests that very small token limits are handled correctly", () => {
      const tinyManager = new MessageManager(10); // Very small limit
      tinyManager.addHuman("This is a message");
      
      // Should have the message
      expect(tinyManager.getMessages().length).toBe(1);
      
      // Add another that would exceed limit
      tinyManager.addHuman("Another long message");
      
      // Should have trimmed to stay under limit (kept only the latest)
      expect(tinyManager.getMessages().length).toBe(1);
      expect(tinyManager.getMessages()[0].content).toBe("Another long message");
    });
  });
});

describe("MessageManagerReadOnly", () => {
  let messageManager: MessageManager;
  let readOnlyView: MessageManagerReadOnly;

  beforeEach(() => {
    messageManager = new MessageManager();
    readOnlyView = new MessageManagerReadOnly(messageManager);
  });

  // Test 1: Verify read-only access to messages
  it("tests that read-only access is provided to all messages", () => {
    // Arrange
    messageManager.addHuman("Hello");
    messageManager.addAI("Hi there!");
    messageManager.addSystem("System prompt");

    // Act
    const messages = readOnlyView.getAll();

    // Assert
    expect(messages).toHaveLength(3);
    expect(messages[0]).toBeInstanceOf(HumanMessage);
    expect(messages[0].content).toBe("Hello");
    expect(messages[1]).toBeInstanceOf(AIMessage);
    expect(messages[1].content).toBe("Hi there!");
    expect(messages[2]).toBeInstanceOf(SystemMessage);
    expect(messages[2].content).toBe("System prompt");
  });

  // Test 2: Verify changes in MessageManager are reflected in read-only view
  it("tests that changes to MessageManager are reflected in read-only view", () => {
    // Arrange
    messageManager.addHuman("First message");
    const initialMessages = readOnlyView.getAll();
    expect(initialMessages).toHaveLength(1);

    // Act
    messageManager.addAI("Response");
    messageManager.addHuman("Follow-up");

    // Assert
    const updatedMessages = readOnlyView.getAll();
    expect(updatedMessages).toHaveLength(3);
    expect(updatedMessages[1].content).toBe("Response");
    expect(updatedMessages[2].content).toBe("Follow-up");
  });

  // Test 3: Verify getAll returns a copy, not the original array
  it("tests that getAll returns a copy to prevent external modifications", () => {
    // Arrange
    messageManager.addHuman("Test message");
    
    // Act
    const messages1 = readOnlyView.getAll();
    const messages2 = readOnlyView.getAll();
    
    // Assert
    expect(messages1).not.toBe(messages2);  // Different array instances
    expect(messages1).toEqual(messages2);    // But same content
    
    // Verify modifying returned array doesn't affect internal state
    messages1.push(new AIMessage("Injected message"));
    const messages3 = readOnlyView.getAll();
    expect(messages3).toHaveLength(1);  // Still only original message
  });
});

describe("MessageManager.fork", () => {
  let messageManager: MessageManager;

  beforeEach(() => {
    messageManager = new MessageManager();
    messageManager.addHuman("Original message");
    messageManager.addAI("Original response");
  });

  // Test 4: Verify fork creates independent copy with history
  it("tests that fork creates independent copy with history", () => {
    // Act
    const forked = messageManager.fork(true);
    
    // Assert - forked has same messages
    expect(forked.getMessages()).toHaveLength(2);
    expect(forked.getMessages()[0].content).toBe("Original message");
    
    // Assert - changes to forked don't affect original
    forked.addHuman("New message in fork");
    expect(forked.getMessages()).toHaveLength(3);
    expect(messageManager.getMessages()).toHaveLength(2);
    
    // Assert - changes to original don't affect forked
    messageManager.addAI("New response in original");
    expect(messageManager.getMessages()).toHaveLength(3);
    expect(forked.getMessages()).toHaveLength(3);
  });
});