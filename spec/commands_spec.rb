require 'spec_helper'

describe "binnacle command" do
  it 'returns an error message for unknown subcommands' do
    expect(`binnacle foo`).to eq("I don't know the subcommand command 'foo'\n")
  end
end
