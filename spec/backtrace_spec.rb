require 'spec_helper'

describe Binnacle::Trap::Backtrace do
  describe Binnacle::Trap::Backtrace::Line do
    describe 'parse' do

      it "should parse a backtrace into lines" do
        array = [
          "app/models/user.rb:13:in `magic'",
          "app/controllers/users_controller.rb:8:in `index'"
        ]

        backtrace = Binnacle::Trap::Backtrace.parse(array)

        line = backtrace.lines.first
        expect(line.number).to eq('13')
        expect(line.file).to eq('app/models/user.rb')
        expect(line.method_name).to eq('magic')

        line = backtrace.lines.last
        expect(line.number).to eq('8')
        expect(line.file).to eq('app/controllers/users_controller.rb')
        expect(line.method_name).to eq('index')
      end

      it "should parse a string backtrace" do
        string = [
          "app/models/user.rb:13:in `magic'",
          "app/controllers/users_controller.rb:8:in `index'"
        ].join("\n")

        backtrace = Binnacle::Trap::Backtrace.parse(string)

        line = backtrace.lines.first
        expect(line.number).to eq('13')
        expect(line.file).to eq('app/models/user.rb')
        expect(line.method_name).to eq('magic')

        line = backtrace.lines.last
        expect(line.number).to eq('8')
        expect(line.file).to eq('app/controllers/users_controller.rb')
        expect(line.method_name).to eq('index')
      end

      it "should parse a windows backtrace into lines" do
        array = [
          "C:/Program Files/Server/app/models/user.rb:13:in `magic'",
          "C:/Program Files/Server/app/controllers/users_controller.rb:8:in `index'"
        ]

        backtrace = Binnacle::Trap::Backtrace.parse(array)

        line = backtrace.lines.first
        expect(line.number).to eq('13')
        expect(line.file).to eq('C:/Program Files/Server/app/models/user.rb')
        expect(line.method_name).to eq('magic')

        line = backtrace.lines.last
        expect(line.number).to eq('8')
        expect(line.file).to eq('C:/Program Files/Server/app/controllers/users_controller.rb')
        expect(line.method_name).to eq('index')
      end

      it "should be equal with equal lines" do
        one = ["app/models/user.rb:13:in `magic'",
          "app/controllers/users_controller.rb:8:in `index'"]
        two = one.dup

        expect(Binnacle::Trap::Backtrace.parse(one)).to eq(Binnacle::Trap::Backtrace.parse(two))
      end

      it "should parse massive one-line exceptions into multiple lines" do
        original_backtrace = Binnacle::Trap::Backtrace.parse(["one:1:in `one'\n   two:2:in `two'\n      three:3:in `three`"])
        expected_backtrace = Binnacle::Trap::Backtrace.parse(["one:1:in `one'", "two:2:in `two'", "three:3:in `three`"])

        expect(original_backtrace).to eq(expected_backtrace)
      end

      context "with a gem root" do
        before do
          @gem_root = '/root/to/gem'
          Gem.path << @gem_root
        end

        it "should filter out the gem root" do
          backtrace_with_gem_root = Binnacle::Trap::Backtrace.parse(
            ["#{@gem_root}/some/gem.rb:9:in `test'",
             "#{@gem_root}/path/to/awesome_gem.rb:13:in `awesome'",
             "/test/something.rb:55:in `hack'"],
            :filters => Binnacle::Configuration::DEFAULT_BACKTRACE_FILTERS)
          backtrace_without_gem_root = Binnacle::Trap::Backtrace.parse(
            ["[GEM_ROOT]/some/gem.rb:9:in `test'",
             "[GEM_ROOT]/path/to/awesome_gem.rb:13:in `awesome'",
             "/test/something.rb:55:in `hack'"])

          expect(backtrace_with_gem_root).to eq(backtrace_without_gem_root)
        end

        it "should ignore empty gem paths" do
          Gem.path << ""
          backtrace_with_gem_root = Binnacle::Trap::Backtrace.parse(
            ["#{@gem_root}/some/gem.rb:9:in `test'",
             "/test/something.rb:55:in `hack'"],
            :filters => Binnacle::Configuration::DEFAULT_BACKTRACE_FILTERS)
          backtrace_without_gem_root = Binnacle::Trap::Backtrace.parse(
            ["[GEM_ROOT]/some/gem.rb:9:in `test'",
             "/test/something.rb:55:in `hack'"])

          expect(backtrace_with_gem_root).to eq(backtrace_without_gem_root)
        end
      end

      it "should remove notifier trace" do
        inside_notifier = [
          "app/models/user.rb:13:in `magic'",
          "app/controllers/users_controller.rb:8:in `index'",
          "lib/binnacle/somewhere.rb:20:in `foobar'"
        ]
        outside_notifier = [
          "app/models/user.rb:13:in `magic'",
          "app/controllers/users_controller.rb:8:in `index'"
        ]

        without_inside = Binnacle::Trap::Backtrace.parse(outside_notifier)
        with_inside    = Binnacle::Trap::Backtrace.parse(inside_notifier,
                           :filters => Binnacle::Configuration::DEFAULT_BACKTRACE_FILTERS
                         )

        expect(without_inside).to eq(with_inside)
      end

      it "should run filters on the backtrace" do
        filters = [lambda { |line| line.sub('foo', 'bar') }]
        input = Binnacle::Trap::Backtrace.parse(["foo:13:in `one'", "baz:14:in `two'"],
                                                 :filters => filters)
        expected = Binnacle::Trap::Backtrace.parse(["bar:13:in `one'", "baz:14:in `two'"])

        expect(expected).to eq(input)
      end

    end
  end
end
