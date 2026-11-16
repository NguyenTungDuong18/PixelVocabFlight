using System;

namespace PixelVocabFlight
{
    // One row of a MenuView page. Plain rows only need Text and Activate; the rest is for slot cards, sliders and choices.
    public sealed class MenuEntry
    {
        public string Text;
        public string Detail;                 // extra lines under the text (slot cards)
        public Action Activate;               // Enter / click
        public bool Enabled = true;
        public bool Card;                     // a tall save-slot card
        public Func<string> Value;            // right-hand value (resolution, on/off), read every frame
        public Func<float> Slider;            // 0..1: draws a slider track and knob, read every frame
        public Action<int> Adjust;            // A/D (-1/+1) on a slider or choice
        public Action<float> SetSlider;       // a click on the track (0..1)
        public string SecondaryText;          // small button at the right of a card ("XÓA")
        public Action Secondary;
    }
}
