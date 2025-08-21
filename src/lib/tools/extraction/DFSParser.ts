import { Logging } from '@/lib/utils/Logging'
import type { DFSNode, DFSExtractionOptions } from './types'

export class DFSParser {
  private accessibilityTree: chrome.browserOS.AccessibilityTree
  
  constructor(tree: chrome.browserOS.AccessibilityTree) {
    this.accessibilityTree = tree
  }
  
  async extractContent(options: DFSExtractionOptions): Promise<ExtractedContent> {
    const startTime = Date.now()
    
    const rootNode = this._convertTree()
    const extractedNodes: DFSNode[] = []
    
    this._traverse(rootNode, options, extractedNodes)
    
    const result = new ExtractedContent(extractedNodes, options)
    
    const duration = Date.now() - startTime
    Logging.log('DFSParser', `Extracted ${extractedNodes.length} nodes in ${duration}ms`, 'info')
    
    return result
  }
  
  private _traverse(
    node: DFSNode, 
    options: DFSExtractionOptions, 
    results: DFSNode[]
  ): void {
    // Include current node if it matches extraction criteria
    if (this._shouldInclude(node, options)) {
      const includedNode = {
        ...node,
        children: [] 
      }
      results.push(includedNode)
    }
    
    // Stop traversing if max depth reached
    if (node.depth >= options.maxDepth) {
      return
    }
    
    // Continue DFS traversal on child nodes
    for (const child of node.children) {
      this._traverse(child, options, results)
    }
  }
  
  private _shouldInclude(node: DFSNode, options: DFSExtractionOptions): boolean {
    if (options.excludeRoles.includes(node.role)) {
      return false
    }
    
    if (options.includeRoles && options.includeRoles.includes(node.role)) {
      return true
    }
    
    switch (options.target) {
      case 'products':
        return this._isProductRelated(node)
      case 'forms':
        return this._isFormRelated(node) 
      case 'navigation':
        return this._isNavigationRelated(node)
      case 'main_content':
        return this._isMainContent(node)
      case 'semantic':
        return this._hasSemanticValue(node, options)
      default:
        return false
    }
  }
  
  private _isProductRelated(node: DFSNode): boolean {
    const productRoles = ['article', 'button', 'heading']
    const productKeywords = ['price', 'cart', 'buy', 'add', 'product', '$']
    
    if (productRoles.includes(node.role)) {
      return true
    }
    
    if (node.name && productKeywords.some(keyword => 
      node.name!.toLowerCase().includes(keyword)
    )) {
      return true
    }
    
    return false
  }
  
  private _isFormRelated(node: DFSNode): boolean {
    const formRoles = ['textbox', 'button', 'checkbox', 'combobox', 'listbox', 'form']
    return formRoles.includes(node.role)
  }
  
  private _isNavigationRelated(node: DFSNode): boolean {
    if (node.role === 'navigation') {
      return true
    }
    
    if (node.role === 'link' && node.name) {
      const navKeywords = ['home', 'menu', 'nav', 'navigation', 'category']
      return navKeywords.some(keyword => 
        node.name!.toLowerCase().includes(keyword)
      )
    }
    
    return false
  }
  
  private _isMainContent(node: DFSNode): boolean {
    const mainRoles = ['main', 'article', 'section']
    return mainRoles.includes(node.role)
  }
  
  private _hasSemanticValue(node: DFSNode, options: DFSExtractionOptions): boolean {
    if (!options.includeText && node.role === 'text') {
      return false
    }
    
    if (!options.includeInteractive && ['button', 'link', 'textbox'].includes(node.role)) {
      return false
    }
    
    if (node.name && node.name.length < options.minTextLength) {
      return false
    }
    
    const semanticRoles = ['heading', 'button', 'link', 'article', 'section', 'text']
    return semanticRoles.includes(node.role)
  }
  
  private _convertTree(): DFSNode {
    const rootNode = this.accessibilityTree.nodes[this.accessibilityTree.rootId.toString()]
    return this._convertNode(rootNode, 0, this.accessibilityTree.nodes)
  }
  
  private _convertNode(
    chromeNode: chrome.browserOS.AccessibilityNode, 
    depth: number,
    allNodes: Record<string, chrome.browserOS.AccessibilityNode>
  ): DFSNode {
    const children: DFSNode[] = []
    
    if (chromeNode.childIds) {
      for (const childId of chromeNode.childIds) {
        const childNode = allNodes[childId.toString()]
        if (childNode) {
          children.push(this._convertNode(childNode, depth + 1, allNodes))
        }
      }
    }
    
    return {
      id: chromeNode.id.toString(),
      role: chromeNode.role || 'generic',
      name: chromeNode.name,
      value: chromeNode.value,
      description: chromeNode.attributes?.description,
      level: chromeNode.attributes?.level,
      depth,
      bounds: undefined,
      focusable: chromeNode.attributes?.focusable || false,
      children
    }
  }
}

export class ExtractedContent {
  constructor(
    private nodes: DFSNode[],
    private options: DFSExtractionOptions
  ) {}
  
  toStructuredText(): string {
    const sections: string[] = []
    const nodesByRole = this._groupByRole()
    
    for (const [role, nodes] of Object.entries(nodesByRole)) {
      if (nodes.length === 0) continue
      
      sections.push(`\n[${role.toUpperCase()}] (${nodes.length} items):`)
      
      nodes.forEach(node => {
        const prefix = this._getRolePrefix(node.role)
        const hierarchyIndent = '  '.repeat(Math.min(node.depth, 3))
        
        sections.push(`${hierarchyIndent}${prefix} ${node.name || node.role}`)
        
        if (node.value) {
          sections.push(`${hierarchyIndent}   Value: "${node.value}"`)
        }
        
        if (node.description) {
          sections.push(`${hierarchyIndent}   Description: "${node.description}"`)
        }
      })
    }
    
    sections.push(`\nEXTRACTION STATS:`)
    sections.push(`   - Total nodes: ${this.nodes.length}`)
    sections.push(`   - Max depth: ${Math.max(...this.nodes.map(n => n.depth))}`)
    sections.push(`   - Target: ${this.options.target}`)
    
    return sections.join('\n')
  }
  
  toJSON(): object {
    return {
      nodes: this.nodes,
      metadata: {
        totalNodes: this.nodes.length,
        maxDepth: Math.max(...this.nodes.map(n => n.depth)),
        target: this.options.target,
        extractedAt: new Date().toISOString()
      }
    }
  }
  
  private _groupByRole(): Record<string, DFSNode[]> {
    return this.nodes.reduce((groups, node) => {
      const roleGroup = groups[node.role] || []
      roleGroup.push(node)
      groups[node.role] = roleGroup
      return groups
    }, {} as Record<string, DFSNode[]>)
  }
  
  private _getRolePrefix(role: string): string {
    const prefixes: Record<string, string> = {
      'button': '[BTN]',
      'link': '[LINK]',
      'heading': '[HEAD]',
      'article': '[ART]',
      'section': '[SEC]',
      'text': '[TEXT]',
      'textbox': '[INPUT]',
      'navigation': '[NAV]'
    }
    return prefixes[role] || '[ELEM]'
  }
}
