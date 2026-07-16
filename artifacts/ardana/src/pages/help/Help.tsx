import React from 'react';
import { HelpCircle, Book, MessageCircle, FileText, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function Help() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <HelpCircle className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl md:text-4xl font-serif font-bold tracking-tight text-foreground">How can we help?</h1>
        <p className="text-muted-foreground mt-2 text-lg">Learn how to make the most of Ardana for your farm.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-sm hover:shadow-md transition-shadow border-primary/20 bg-primary/5">
          <CardContent className="p-6 text-center">
            <Book className="w-8 h-8 text-primary mx-auto mb-3" />
            <h3 className="font-bold mb-2">Getting Started Guide</h3>
            <p className="text-sm text-muted-foreground">The basics of setting up your digital farm.</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6 text-center">
            <FileText className="w-8 h-8 text-secondary mx-auto mb-3" />
            <h3 className="font-bold mb-2">AI Tools Tutorial</h3>
            <p className="text-sm text-muted-foreground">How to take good photos for accurate diagnosis.</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6 text-center">
            <MessageCircle className="w-8 h-8 text-accent-foreground mx-auto mb-3" />
            <h3 className="font-bold mb-2">Contact Support</h3>
            <p className="text-sm text-muted-foreground">Can't find the answer? Reach out to us.</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-12">
        <h2 className="text-2xl font-serif font-bold mb-6">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="w-full bg-card border rounded-2xl px-6">
          <AccordionItem value="item-1" className="border-b">
            <AccordionTrigger className="hover:no-underline font-semibold text-left">
              How accurate is the AI disease detector?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              Our AI is trained on over 50,000 images of crop diseases common in the Mediterranean and Middle Eastern climates. It has an average accuracy of 92% for common diseases. However, it should be used as a guide, not a definitive diagnosis. Always consult a local agricultural expert for severe issues.
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-2" className="border-b">
            <AccordionTrigger className="hover:no-underline font-semibold text-left">
              Can I use Ardana offline?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              Currently, Ardana requires an internet connection for the AI identification and weather features. However, you can view your cached plant list and reminders when offline. We are working on a full offline mode for remote farms in a future update.
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-3" className="border-b">
            <AccordionTrigger className="hover:no-underline font-semibold text-left">
              How do the watering reminders work?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              When you add a plant, you set a watering interval (e.g., every 3 days). Ardana calculates the next due date based on the last time you logged a watering event. If it rains heavily, you can adjust the schedule or skip a reminder manually.
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-4" className="border-none">
            <AccordionTrigger className="hover:no-underline font-semibold text-left">
              Is my farm data private?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              Yes. We take privacy seriously. Your farm data, locations, and photos are yours alone. We do not sell your data to third parties. Photos uploaded for AI identification are processed securely and not added to public datasets without explicit permission.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
