import { Heading } from '@tiptap/extension-heading'
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import {MouseEvent, useEffect, useState} from 'react'

const AnchorIcon = ({ id }: { id: string }) => {
  const handleCopy = (e: MouseEvent) => {
    e.stopPropagation()
    if (id) {
      let url = window.location.host + window.location.pathname;
      navigator.clipboard.writeText(url + '#' + id)
    }
  }
  return (
    <span
      style={{
        cursor: 'pointer',
        marginLeft: '0.5rem',
        verticalAlign: 'middle',
        opacity: 0.4,
      }}
      title="Copy heading link"
      onClick={handleCopy}
    >
      🔗
    </span>
  )
}

const CustomHeadingComponent = (props: any) => {
  const { node } = props
  const [id, setId] = useState(node.attrs.id);
  const level = node.attrs.level;

  useEffect(() => {
    setId(node.attrs.id);
  }, [node.attrs.id]);

  return (
    <NodeViewWrapper
      as={`h${level}`}
      className="custom-heading"
      {...node.attrs}
    >
      <NodeViewContent style={{ display: 'inline' }} />          
      {node.content.size > 0 && <AnchorIcon id={id} />}
    </NodeViewWrapper>
  )
}

export const CustomHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      id: {
        default: null,
        parseHTML: element => element.getAttribute('id'),
        renderHTML: attributes => {
          if (!attributes.id) {
            return {}
          }
          return { id: attributes.id }
        },
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(CustomHeadingComponent)
  },
})
