# Classic Acid House Track
use_bpm 128

live_loop :acid_kick do
  sample :bd_haus, amp: 1.5
  sleep 1
end

live_loop :acid_hats do
  sample :drum_cymbal_closed, amp: 0.6
  sleep 0.25
  sample :drum_cymbal_closed, amp: 0.4
  sleep 0.25
  sample :drum_cymbal_closed, amp: 0.6
  sleep 0.25
  sample :drum_cymbal_closed, amp: 0.5
  sleep 0.25

  if one_in(4)
    sample :drum_cymbal_open, amp: 0.5, release: 0.3
  end
end

live_loop :acid_bass do
  use_synth :tb303
  use_synth_defaults release: 0.2, cutoff: 70, res: 0.8, wave: 1

  notes = (scale :e2, :minor_pentatonic, num_octaves: 2)

  16.times do
    cutoff_val = rrand(60, 120)
    res_val = rrand(0.7, 0.95)

    use_synth_defaults release: 0.15, cutoff: cutoff_val, res: res_val, wave: 1

    play notes.choose, amp: 0.8
    sleep 0.25
  end
end

live_loop :acid_clap do
  sleep 1
  sample :drum_snare_hard, amp: 0.7
  sleep 1
end
